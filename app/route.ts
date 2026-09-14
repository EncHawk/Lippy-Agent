export function GET() {
  return Response.json({ name: "Lippy Agent", service: "Self-healing extraction backend", api: "/api/contracts", mcp: "/api/mcp", login: "/api/auth/google" });
}
