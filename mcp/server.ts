import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createContract, listContracts, getContract, triggerRun, getData, getRun } from "@/lib/contracts/service";
import { contractDefinitionSchema } from "@/lib/contracts/schema";
import { readEvents } from "@/lib/events/bus";
import { cursor } from "@/lib/http";
import { toErrorResponse } from "@/lib/errors";
export function createMcpServer(ownerId: string) {
  const server = new McpServer({ name: "lippy-agent", version: "1.0.0" });
  async function result(action: () => Promise<unknown>) {
    try { return { content: [{ type: "text" as const, text: JSON.stringify(await action()) }] }; }
    catch (error) { return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(toErrorResponse(error).body) }] }; }
  }
  server.registerTool("create_contract", { description: "Create an owned extraction contract; the worker provisions its scraper asynchronously.", inputSchema: contractDefinitionSchema.shape }, input => result(() => createContract(input, ownerId)));
  server.registerTool("list_contracts", { description: "List your extraction contracts", inputSchema: {} }, () => result(() => listContracts(ownerId)));
  server.registerTool("run_contract", { description: "Enqueue a run and return its persisted ID immediately", inputSchema: { contractId: z.string(), idempotencyKey: z.string().min(1).max(128).optional() } }, ({ contractId, idempotencyKey }) => result(() => triggerRun(contractId, ownerId, idempotencyKey)));
  server.registerTool("get_run", { description: "Read persisted execution state, errors and repair attempts", inputSchema: { runId: z.string() } }, ({ runId }) => result(() => getRun(runId, ownerId)));
  server.registerTool("get_data", { description: "Read last accepted data; unverified and suspicious results are excluded", inputSchema: { contractId: z.string() } }, ({ contractId }) => result(() => getData(contractId, ownerId)));
  server.registerTool("watch_contract", { description: "Read durable events after a sequence cursor; call again with the last sequence to follow progress", inputSchema: { contractId: z.string(), after: z.string().optional() } }, ({ contractId, after }) => result(async () => {
    await getContract(contractId, ownerId); return readEvents(contractId, cursor(after ?? null));
  }));
  return server;
}
