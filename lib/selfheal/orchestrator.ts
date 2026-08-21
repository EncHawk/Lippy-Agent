import { brightData } from "../brightdata/client";
import { parallel } from "../parallel/client";
import { validateAgainstContract, type FieldViolation } from "../contracts/validator";
import type { ContractField } from "../contracts/schema";
import { eventBus } from "../events/bus";
import { HealExhaustedError } from "../errors";
import { createLogger } from "../logger";

const log = createLogger("self-heal-orchestrator");

const MAX_HEAL_ATTEMPTS = 3;

export type OrchestratorResult = {
  outcome: "valid" | "healed" | "escalated";
  data: Record<string, unknown> | null;
  fieldChanges: { field: string; previousValue: unknown; currentValue: unknown; confidence: number }[];
};

/**
 * The core loop. Modeled as an explicit sequence of named states rather than
 * nested if/else so it reads as a state machine and is unit-testable step
 * by step:
 *
 *   extracting -> validating -> (healthy: diffing -> done)
 *                             -> (violated: healing -> verifying -> done)
 *                                                    -> (still broken, retry up to MAX_HEAL_ATTEMPTS)
 *                                                    -> (exhausted: escalating -> done)
 */
export async function runContract(args: {
  contractId: string;
  collectorId: string;
  fields: ContractField[];
  previousValues: Record<string, unknown>;
}): Promise<OrchestratorResult> {
  const { contractId, collectorId, fields, previousValues } = args;
  const runId = `run_${Date.now()}`;

  // 1. extracting
  let extraction = await brightData.runCollector(collectorId);

  // 2. validating
  let validation = validateAgainstContract(fields, extraction.data);

  // 3. heal loop, only entered if validation failed
  let attempt = 0;
  while (!validation.ok && attempt < MAX_HEAL_ATTEMPTS) {
    attempt += 1;
    await eventBus.publish({
      type: "contract.violated",
      contractId,
      runId,
      violations: validation.violations,
    });
    await eventBus.publish({ type: "contract.healing", contractId, runId, attempt });

    const healed = await attemptHeal(collectorId, validation.violations);

    extraction = await brightData.runCollector(collectorId);
    validation = validateAgainstContract(fields, extraction.data);

    if (validation.ok) {
      await eventBus.publish({
        type: "contract.healed",
        contractId,
        runId,
        attempt,
        selectorDiff: healed.diff,
      });
    }
  }

  // 4. escalate if still broken after MAX_HEAL_ATTEMPTS
  if (!validation.ok) {
    await eventBus.publish({
      type: "contract.escalated",
      contractId,
      runId,
      attempts: attempt,
      reason: describeViolations(validation.violations),
    });
    log.error("heal exhausted, escalating", { contractId, attempts: attempt });
    throw new HealExhaustedError(contractId, attempt);
  }

  // 5. semantic diff against previous known-good values, field by field
  const fieldChanges: OrchestratorResult["fieldChanges"] = [];
  for (const field of fields) {
    const previousValue = previousValues[field.key];
    const currentValue = validation.data[field.key];
    const diff = await parallel.diffField({ field: field.key, type: field.type, previousValue, currentValue });

    if (diff.changed) {
      fieldChanges.push({ field: field.key, previousValue, currentValue, confidence: diff.confidence });
      await eventBus.publish({
        type: "field.changed",
        contractId,
        runId,
        field: field.key,
        previousValue,
        currentValue,
        confidence: diff.confidence,
        summary: diff.summary,
      });
    }
  }

  return {
    outcome: attempt > 0 ? "healed" : "valid",
    data: validation.data,
    fieldChanges,
  };
}

async function attemptHeal(collectorId: string, violations: FieldViolation[]) {
  const { jobId } = await brightData.refactorTemplate({
    collectorId,
    prompt: buildHealPrompt(violations),
  });

  const progress = await brightData.pollRefactorProgress(jobId);

  if (progress.status === "pending_answer") {
    // The auto-approve unlock: accept the AI's proposed diff without a
    // human clicking through the Scraper Studio UI.
    await brightData.resumeAutomationJob(jobId);
  }

  return progress;
}

function buildHealPrompt(violations: FieldViolation[]): string {
  const fieldList = violations.map((v) => `"${v.key}" (expected ${v.expectedType}, got ${JSON.stringify(v.received)})`);
  return `The following fields are no longer extracting correctly: ${fieldList.join(", ")}. Update the selectors to correctly extract these fields.`;
}

function describeViolations(violations: FieldViolation[]): string {
  return violations.map((v) => `${v.key}: expected ${v.expectedType}, got ${JSON.stringify(v.received)}`).join("; ");
}
