import { db } from "../db";
import { brightData } from "../brightdata/client";
import { runContract } from "../selfheal/orchestrator";
import { contractDefinitionSchema, type ContractDefinition, type ContractField } from "./schema";
import { ContractNotFoundError, RunAlreadyInFlightError } from "../errors";

/**
 * All contract business logic lives here, not in API route handlers or MCP
 * tool handlers — both of those are thin adapters that parse a request,
 * call into this service, and shape a response. This means the MCP
 * `create_contract` tool and the `POST /api/contracts` route can never
 * silently diverge in behavior, because they call the exact same function.
 */

const inFlightRuns = new Set<string>();

export async function createContract(input: unknown) {
  const definition: ContractDefinition = contractDefinitionSchema.parse(input);

  const { collectorId } = await brightData.createScraper({
    url: definition.url,
    description: describeContractForScraperStudio(definition.fields),
  });

  const contract = await db.contract.create({
    data: {
      url: definition.url,
      schema: JSON.stringify(definition.fields),
      pollIntervalMs: definition.pollIntervalMs,
      collectorId,
      status: "healthy",
    },
  });

  return contract;
}

export async function getContract(contractId: string) {
  const contract = await db.contract.findUnique({ where: { id: contractId } });
  if (!contract) throw new ContractNotFoundError(contractId);
  return contract;
}

export async function listContracts() {
  return db.contract.findMany({ orderBy: { createdAt: "desc" } });
}

export async function triggerRun(contractId: string) {
  if (inFlightRuns.has(contractId)) {
    throw new RunAlreadyInFlightError(contractId);
  }
  inFlightRuns.add(contractId);

  try {
    const contract = await getContract(contractId);
    if (!contract.collectorId) {
      throw new Error(`Contract "${contractId}" has no associated collector.`);
    }

    const fields: ContractField[] = JSON.parse(contract.schema);
    const lastRun = await db.run.findFirst({
      where: { contractId, outcome: { in: ["valid", "healed"] } },
      orderBy: { startedAt: "desc" },
    });
    const previousValues: Record<string, unknown> = lastRun?.validated ? JSON.parse(lastRun.validated) : {};

    const run = await db.run.create({ data: { contractId } });

    try {
      const result = await runContract({
        contractId,
        collectorId: contract.collectorId,
        fields,
        previousValues,
      });

      await db.run.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          outcome: result.outcome,
          validated: JSON.stringify(result.data),
        },
      });
      await db.contract.update({ where: { id: contractId }, data: { status: "healthy" } });

      return result;
    } catch (err) {
      await db.run.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), outcome: "escalated" },
      });
      await db.contract.update({ where: { id: contractId }, data: { status: "broken" } });
      throw err;
    }
  } finally {
    inFlightRuns.delete(contractId);
  }
}

export async function getContractHistory(contractId: string) {
  await getContract(contractId); // 404s if missing
  const [runs, events] = await Promise.all([
    db.run.findMany({ where: { contractId }, orderBy: { startedAt: "desc" }, take: 50 }),
    db.contractEvent.findMany({ where: { contractId }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return { runs, events };
}

/**
 * Single round-trip variant for the detail page: one contract fetch plus
 * runs/events in parallel. The old page called getContract AND
 * getContractHistory (which internally re-fetched the contract), tripling
 * DB latency on every navigation — this exists so the page does exactly
 * one await against a possibly-remote Postgres.
 */
export async function getContractWithHistory(contractId: string) {
  const contract = await db.contract.findUnique({ where: { id: contractId } });
  if (!contract) throw new ContractNotFoundError(contractId);
  const [runs, events] = await Promise.all([
    db.run.findMany({ where: { contractId }, orderBy: { startedAt: "desc" }, take: 50 }),
    db.contractEvent.findMany({ where: { contractId }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return { contract, runs, events };
}

function describeContractForScraperStudio(fields: ContractField[]): string {
  const fieldList = fields.map((f) => `${f.key} (${f.type}${f.required ? ", required" : ""})`).join(", ");
  return `Extract the following fields: ${fieldList}.`;
}
