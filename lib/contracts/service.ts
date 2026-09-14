import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db";
import { env } from "../env";
import { publish, readEvents } from "../events/bus";
import { contractDefinitionSchema } from "./schema";
import { ContractNotFoundError, RunAlreadyInFlightError } from "../errors";
import { createFixture } from "../fixtures/scraper";
export async function createContract(input: unknown, ownerId: string) {
  const d = contractDefinitionSchema.parse(input);
  if (env.EXTRACTION_PROVIDER === "brightdata" && !env.BRIGHTDATA_API_KEY) throw new Error("BRIGHTDATA_API_KEY is missing");
  if (env.EXTRACTION_PROVIDER === "brightdata" && !d.collectorId && !env.BRIGHTDATA_DELIVERY_EMAIL) throw new Error("Set BRIGHTDATA_DELIVERY_EMAIL or provide collectorId");
  return db.contract.create({ data: {
    ownerId, url: d.url, schema: JSON.stringify(d.fields), pollIntervalMs: d.pollIntervalMs,
    enabled: d.enabled, collectorId: d.collectorId, provider: env.EXTRACTION_PROVIDER,
    fixture: env.EXTRACTION_PROVIDER === "fixture" ? JSON.stringify(createFixture(d.fields)) : null,
  } });
}
export async function getContract(id: string, ownerId: string) {
  const c = await db.contract.findFirst({ where: { id, ownerId } });
  if (!c) throw new ContractNotFoundError(id);
  return c;
}
export async function listContracts(ownerId: string) {
  return db.contract.findMany({ where: { ownerId }, orderBy: { createdAt: "desc" }, take: 100 });
}
export async function triggerRun(contractId: string, ownerId: string, key?: string) {
  await getContract(contractId, ownerId);
  if (key !== undefined) z.string().min(1).max(128).parse(key);
  return enqueueRun(contractId, key);
}
/** Internal scheduler entry point; callers outside this module must enforce ownership. */
export async function enqueueRun(contractId: string, key?: string, scheduled = false) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Contract" WHERE id = ${contractId} FOR UPDATE`;
    const c = await tx.contract.findUniqueOrThrow({ where: { id: contractId } });
    if (key) {
      const existing = await tx.run.findUnique({ where: { contractId_idempotencyKey: { contractId, idempotencyKey: key } } });
      if (existing) return existing;
    }
    if (scheduled && (!c.enabled || c.nextRunAt > new Date())) return null;
    if (c.activeRunId) {
      if (scheduled) return null;
      throw new RunAlreadyInFlightError(contractId);
    }
    if (c.status === "review_required" || c.status === "indeterminate") throw new RunAlreadyInFlightError(contractId);
    const run = await tx.run.create({ data: { id: randomUUID(), contractId, idempotencyKey: key, deadlineAt: new Date(Date.now() + env.RUN_TIMEOUT_MS) } });
    await tx.contract.update({ where: { id: contractId }, data: { activeRunId: run.id, nextRunAt: new Date(Date.now() + c.pollIntervalMs) } });
    await publish(tx, { type: "run.queued", contractId, runId: run.id });
    return run;
  });
}
export async function getContractHistory(contractId: string, ownerId: string) {
  await getContract(contractId, ownerId);
  const runs = await db.run.findMany({ where: { contractId }, orderBy: { startedAt: "desc" }, take: 50, include: { repairs: true } });
  const events = await readEvents(contractId);
  return { runs, events };
}
export async function getData(contractId: string, ownerId: string) {
  const contract = await getContract(contractId, ownerId);
  const run = await db.run.findFirst({ where: { contractId, outcome: { in: ["valid", "healed"] } }, orderBy: { finishedAt: "desc" } });
  return { contractId, status: contract.status, runId: run?.id ?? null, acceptedAt: run?.finishedAt ?? null, data: run?.validated ? JSON.parse(run.validated) : null };
}
export async function getRun(runId: string, ownerId: string) {
  const run = await db.run.findFirst({ where: { id: runId, contract: { ownerId } }, include: { repairs: true } });
  if (!run) throw new ContractNotFoundError(runId);
  return run;
}
export async function setEnabled(contractId: string, ownerId: string, enabled: boolean) {
  await getContract(contractId, ownerId);
  return db.contract.update({ where: { id: contractId }, data: { enabled, nextRunAt: new Date() } });
}

export async function reviewRun(runId: string, ownerId: string, decision: "accept" | "reject") {
  const run = await getRun(runId, ownerId);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Contract" WHERE id = ${run.contractId} FOR UPDATE`;
    const current = await tx.run.findUniqueOrThrow({ where: { id: runId } });
    if (current.outcome !== "review_required") throw new RunAlreadyInFlightError(run.contractId);
    const outcome = decision === "accept" ? (current.healAttempts ? "healed" : "valid") : "rejected";
    const updated = await tx.run.update({ where: { id: runId }, data: { state: outcome, outcome, finishedAt: new Date() } });
    await tx.contract.update({ where: { id: run.contractId }, data: { status: decision === "accept" ? "healthy" : "broken", enabled: false } });
    await publish(tx, { type: `run.review_${decision}`, contractId: run.contractId, runId, reviewedBy: ownerId });
    return updated;
  });
}
export async function reconcileRun(runId: string, ownerId: string, note: string, collectorId?: string) {
  const run = await getRun(runId, ownerId);
  z.string().min(10).max(2000).parse(note);
  if (collectorId) z.string().regex(/^c_[a-zA-Z0-9_]+$/).parse(collectorId);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Contract" WHERE id = ${run.contractId} FOR UPDATE`;
    const current = await tx.run.findUniqueOrThrow({ where: { id: runId } });
    if (current.outcome !== "indeterminate") throw new RunAlreadyInFlightError(run.contractId);
    await tx.run.update({ where: { id: runId }, data: { state: "reconciled", outcome: "reconciled" } });
    await tx.contract.update({ where: { id: run.contractId }, data: { status: "broken", enabled: false, ...(collectorId ? { collectorId } : {}) } });
    await publish(tx, { type: "run.reconciled", contractId: run.contractId, runId, note, reconciledBy: ownerId });
    return { runId, state: "reconciled" };
  });
}
