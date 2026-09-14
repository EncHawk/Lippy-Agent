import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/mcp/server";
import { requireUser } from "@/lib/auth/service";
import { endpoint } from "@/lib/http";
export async function POST(req: Request) { return endpoint(async () => {
  const owner = await requireUser(req);
  const server = createMcpServer(owner);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try { return await transport.handleRequest(req); }
  finally { await server.close(); }
}); }
export function GET() { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
export const DELETE = GET;
