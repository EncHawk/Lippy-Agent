import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createContract, getContract, getContractHistory, triggerRun } from "@/lib/contracts/service";
import { contractFieldSchema } from "@/lib/contracts/schema";

/**
 * The MCP surface is intentionally a thin wrapper over the exact same
 * `lib/contracts/service.ts` functions the HTTP API routes call. An agent
 * calling `create_contract` and a person using the dashboard's "New
 * Contract" form go through identical validation and identical Bright Data
 * calls — there's exactly one code path for "create a contract," not two
 * that could drift.
 */
export function createMcpServer() {
  const server = new McpServer({ name: "web-contracts", version: "0.1.0" });

  server.registerTool(
    "create_contract",
    {
      description:
        "Define a durable data contract for a website: a URL plus a typed schema of fields to extract. Returns a contract id.",
      inputSchema: {
        url: z.string().url(),
        fields: z.array(contractFieldSchema),
        pollIntervalMs: z.number().int().positive().optional(),
      },
    },
    async ({ url, fields, pollIntervalMs }) => {
      const contract = await createContract({ url, fields, pollIntervalMs });
      return {
        content: [{ type: "text", text: JSON.stringify({ contractId: contract.id, status: contract.status }) }],
      };
    },
  );

  server.registerTool(
    "get_data",
    {
      description: "Get the current validated data for a contract, plus recent run history.",
      inputSchema: { contractId: z.string() },
    },
    async ({ contractId }) => {
      const [contract, history] = await Promise.all([getContract(contractId), getContractHistory(contractId)]);
      return {
        content: [{ type: "text", text: JSON.stringify({ contract, ...history }) }],
      };
    },
  );

  server.registerTool(
    "watch_contract",
    {
      description:
        "Trigger an immediate run of a contract (extract, validate, self-heal if needed, semantic-diff against the last known-good value). Events fire on the contract's SSE/webhook channel as they happen.",
      inputSchema: { contractId: z.string() },
    },
    async ({ contractId }) => {
      const result = await triggerRun(contractId);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );

  return server;
}
