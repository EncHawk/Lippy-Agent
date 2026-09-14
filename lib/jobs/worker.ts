import { randomUUID } from "node:crypto";
import type { Prisma, Run } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { publish } from "../events/bus";
import { enqueueRun } from "../contracts/service";
import { contractFieldSchema } from "../contracts/schema";
import { validateAgainstContract } from "../contracts/validator";
import { diffFields } from "../semantic/diff";
import { extractFixture, repairFixture, type Fixture } from "../fixtures/scraper";
import { brightData, ProviderError } from "../brightdata/client";
const LEASE_MS = 120000;
export class LeaseLostError extends Error {}
export async function claimRun(): Promise<Run | null> {
  const token = randomUUID();
  const rows = await db.$queryRaw<Run[]>`
    UPDATE "Run" SET "leaseToken" = ${token}, "leaseUntil" = NOW() + INTERVAL '120 seconds'
    WHERE id = (SELECT id FROM "Run" WHERE "finishedAt" IS NULL AND "availableAt" <= NOW()
      AND ("leaseUntil" IS NULL OR "leaseUntil" < NOW()) ORDER BY "availableAt", "startedAt"
      FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`;
  return rows[0] ?? null;
}
/** A fencing token and lease deadline prevent a stale worker from committing results. */
async function transition(run: Run, state: string, data: Prisma.RunUpdateManyMutationInput = {}, extra?: (tx: Prisma.TransactionClient) => Promise<void>, release = true) {
  const result = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Contract" WHERE id = ${run.contractId} FOR UPDATE`;
    const result = await tx.run.updateMany({ where: { id: run.id, leaseToken: run.leaseToken, leaseUntil: { gt: new Date() }, finishedAt: null }, data: {
      state, ...(state !== run.state ? { retryCount: 0, error: null } : {}), ...data, ...(release ? { leaseToken: null, leaseUntil: null } : {}),
    } });
    if (!result.count) throw new LeaseLostError("Worker lease expired or was replaced");
    if (extra) await extra(tx);
    if (state !== run.state) await publish(tx, { type: `run.${state}`, contractId: run.contractId, runId: run.id, previousState: run.state });
    return tx.run.findUniqueOrThrow({ where: { id: run.id } });
  });
  Object.assign(run, result);
}
async function finish(run: Run, outcome: string, error?: string) {
  await transition(run, outcome, { outcome, finishedAt: new Date(), error: error ?? null }, async tx => {
    const c = await tx.contract.findUniqueOrThrow({ where: { id: run.contractId } });
    await tx.contract.update({ where: { id: c.id }, data: {
      activeRunId: null, status: outcome === "valid" || outcome === "healed" ? "healthy" : outcome === "review_required" || outcome === "indeterminate" ? outcome : "broken",
      enabled: ["review_required", "indeterminate", "escalated", "failed"].includes(outcome) ? false : c.enabled,
      nextRunAt: new Date(Date.now() + c.pollIntervalMs),
    } });
    if (run.healAttempts > 0) await tx.repairAttempt.updateMany({ where: { runId: run.id, attempt: run.healAttempts }, data: { status: outcome } });
    await publish(tx, { type: `contract.${outcome === "valid" ? "healthy" : outcome}`, contractId: run.contractId, runId: run.id, reason: error });
  });
}
async function waitForPoll(run: Run) {
  await transition(run, run.state, { availableAt: new Date(Date.now() + env.PROVIDER_POLL_MS), retryCount: 0, error: null });
}
/** Persist intent before a non-idempotent provider call. A crash in this window requires
 * reconciliation, not blindly replaying a potentially billable external operation. */
async function submit(run: Run, state: string, action: () => Promise<void>) {
  await transition(run, `${state}_submitting`, {}, undefined, false);
  await action();
}
export async function processRun(run: Run): Promise<void> {
  try {
    if (run.state.endsWith("_submitting")) { await finish(run, "indeterminate", "Provider submission interrupted; reconcile the provider job before starting another run"); return; }
    if (run.deadlineAt <= new Date()) { await finish(run, "failed", "Run deadline exceeded"); return; }
    const c = await db.contract.findUniqueOrThrow({ where: { id: run.contractId } });
    const fields = contractFieldSchema.array().parse(JSON.parse(c.schema));
    const fixture = c.fixture ? JSON.parse(c.fixture) as Fixture : null;
    const collector = c.collectorId;
    switch (run.state) {
      case "queued":
        await transition(run, c.provider === "fixture" || collector ? "extracting" : "provisioning"); return;
      case "provisioning":
        await submit(run, "provisioning", async () => {
          const id = await brightData.createScraper(`Lippy ${c.id}`);
          await transition(run, "generating", {}, async tx => { await tx.contract.update({ where: { id: c.id }, data: { collectorId: id } }); });
        }); return;
      case "generating":
        await submit(run, "generating", async () => {
          await brightData.generate(collector!, c.url, `Extract one record using these exact keys and types: ${fields.map(f => `${f.key}:${f.type}${f.description ? ` (${f.description})` : ""}`).join(", ")}`);
          await transition(run, "generation_poll");
        }); return;
      case "generation_poll": {
        const progress = await brightData.progress(collector!, false);
        if (progress.status === "done") await transition(run, "extracting");
        else if (progress.status === "failed" || progress.status === "pending_answer") await finish(run, "failed", "Scraper generation failed or needs input in Bright Data Studio");
        else await waitForPoll(run);
        return;
      }
      case "extracting":
        if (fixture) { await transition(run, "validating", { rawOutput: JSON.stringify(extractFixture(fixture, fields)) }); return; }
        await submit(run, "extracting", async () => {
          const providerJobId = await brightData.trigger(collector!, c.url, run.id);
          await transition(run, "extraction_poll", { providerJobId });
        }); return;
      case "extraction_poll": {
        const data = await brightData.results(run.providerJobId!);
        if (data) await transition(run, "validating", { rawOutput: JSON.stringify(data), retryCount: 0 });
        else await waitForPoll(run);
        return;
      }
      case "validating": {
        const validation = validateAgainstContract(fields, JSON.parse(run.rawOutput!));
        if (validation.ok) { await transition(run, "diffing", { validated: JSON.stringify(validation.data) }); return; }
        const violations = JSON.stringify(validation.violations);
        if (run.healAttempts >= env.MAX_HEAL_ATTEMPTS) { await finish(run, "escalated", "Repair attempts exhausted"); return; }
        const attempt = run.healAttempts + 1;
        await transition(run, "healing", { violations, healAttempts: attempt }, async tx => {
          await tx.contract.update({ where: { id: c.id }, data: { status: "healing" } });
          if (attempt > 1) await tx.repairAttempt.updateMany({ where: { runId: run.id, attempt: attempt - 1 }, data: { status: "rejected" } });
          await tx.repairAttempt.create({ data: { runId: run.id, attempt, status: "requested", violations } });
          await publish(tx, { type: "contract.violated", contractId: c.id, runId: run.id, violations: validation.violations });
          await publish(tx, { type: "contract.healing", contractId: c.id, runId: run.id, attempt });
        }); return;
      }
      case "healing":
        if (fixture) {
          const repaired = repairFixture(fixture, fields);
          await transition(run, "extracting", {}, async tx => {
            await tx.contract.update({ where: { id: c.id }, data: { fixture: JSON.stringify(repaired.fixture) } });
            await tx.repairAttempt.update({ where: { runId_attempt: { runId: run.id, attempt: run.healAttempts } }, data: { status: "verifying", proposal: JSON.stringify(repaired.diff) } });
          }); return;
        }
        await submit(run, "healing", async () => {
          await brightData.heal(collector!, c.url, `Repair extraction selectors without changing field meaning or output schema. Field definitions: ${JSON.stringify(fields)}. Violations: ${run.violations}`);
          await transition(run, "heal_poll");
        }); return;
      case "heal_poll": {
        const progress = await brightData.progress(collector!, true);
        if (progress.status === "failed") { await finish(run, "escalated", "Bright Data repair failed"); return; }
        if (progress.status === "done") { await transition(run, "extracting"); return; }
        if (progress.status === "pending_answer") {
          if (progress.step !== "user_approval") { await finish(run, "escalated", "Repair requires an answer beyond diff approval"); return; }
          const attempt = await db.repairAttempt.findUniqueOrThrow({ where: { runId_attempt: { runId: run.id, attempt: run.healAttempts } } });
          if (attempt.status === "approved") { await waitForPoll(run); return; }
          await transition(run, "heal_approve", {}, async tx => {
            await tx.repairAttempt.update({ where: { runId_attempt: { runId: run.id, attempt: run.healAttempts } }, data: { status: "proposed", proposal: JSON.stringify(progress) } });
          }); return;
        }
        await waitForPoll(run); return;
      }
      case "heal_approve":
        await submit(run, "heal_approve", async () => {
          await brightData.approve(collector!);
          await transition(run, "heal_poll", { availableAt: new Date(Date.now() + env.PROVIDER_POLL_MS) }, async tx => {
            await tx.repairAttempt.update({ where: { runId_attempt: { runId: run.id, attempt: run.healAttempts } }, data: { status: "approved" } });
          });
        }); return;
      case "diffing": {
        const previous = await db.run.findFirst({ where: { contractId: c.id, outcome: { in: ["valid", "healed"] } }, orderBy: { finishedAt: "desc" } });
        const changes = diffFields(fields, previous?.validated ? JSON.parse(previous.validated) : null, JSON.parse(run.validated!));
        await transition(run, "accepting", { fieldChanges: JSON.stringify(changes) }, async tx => {
          for (const change of changes) await publish(tx, { type: change.reviewRequired ? "field.suspicious" : "field.changed", contractId: c.id, runId: run.id, ...change });
        }); return;
      }
      case "accepting": {
        const changes = JSON.parse(run.fieldChanges ?? "[]") as { reviewRequired: boolean }[];
        await finish(run, changes.some(c => c.reviewRequired) ? "review_required" : run.healAttempts > 0 ? "healed" : "valid"); return;
      }
      default: await finish(run, "failed", `Unknown persisted state: ${run.state}`);
    }
  } catch (error) {
    if (error instanceof LeaseLostError) return;
    const message = error instanceof Error ? error.message : "Unknown worker error";
    if (run.state.endsWith("_submitting")) { await finish(run, "indeterminate", message); return; }
    if (error instanceof ProviderError && error.retryable && run.retryCount < 5) {
      await transition(run, run.state, { retryCount: run.retryCount + 1, error: message, availableAt: new Date(Date.now() + Math.min(60000, 1000 * 2 ** run.retryCount)) });
    } else await finish(run, "failed", message);
  }
}
export async function scheduleDue() {
  const due = await db.contract.findMany({ where: { enabled: true, activeRunId: null, nextRunAt: { lte: new Date() }, status: { notIn: ["review_required", "indeterminate"] } }, take: 100, orderBy: { nextRunAt: "asc" } });
  for (const c of due) await enqueueRun(c.id, undefined, true);
}
export async function tick() {
  await scheduleDue();
  const run = await claimRun();
  if (run) await processRun(run);
  return Boolean(run);
}
export { LEASE_MS };
