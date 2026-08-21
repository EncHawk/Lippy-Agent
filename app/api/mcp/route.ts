import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/mcp/server";

/**
 * Exposes the MCP server over Streamable HTTP at /api/mcp so any MCP client
 * (Claude, Cursor, a custom agent) can connect with just this URL — no
 * separate process to run.
 *
 * Uses the Web-Standard variant of the transport so we can hand it the
 * Next.js Request directly (no Node IncomingMessage adapter needed) and
 * receive a Response back — keeps the handler Web-Request-shaped end to
 * end, which is the shape Next.js's edge/node runtime speaks.
 *
 * A fresh transport per request keeps this stateless and safe for
 * serverless deployment.
 */
export async function POST(req: Request) {
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(req);
}
