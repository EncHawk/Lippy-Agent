import type { Prisma } from "@prisma/client";
import { db } from "../db";
import type { ContractEvent } from "./types";
/** The durable event log is the pub/sub transport. Each subscriber owns its cursor.
 * Publishers use the state-change transaction: an event cannot exist without its state.
 */
export async function publish(tx: Prisma.TransactionClient, event: ContractEvent) {
  await tx.$queryRaw`SELECT id FROM "Contract" WHERE id = ${event.contractId} FOR UPDATE`;
  return tx.contractEvent.create({ data: {
    contractId: event.contractId, runId: event.runId, type: event.type, payload: JSON.stringify(event),
  } });
}
export async function readEvents(contractId: string, after = 0n, take = 100) {
  const events = await db.contractEvent.findMany({ where: { contractId, sequence: { gt: after } }, orderBy: { sequence: "asc" }, take });
  return events.map(({ sequence, ...event }) => ({ ...event, sequence: sequence.toString(), data: JSON.parse(event.payload) }));
}
