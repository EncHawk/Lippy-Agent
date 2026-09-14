import { requireUser } from "@/lib/auth/service";
import { triggerRun } from "@/lib/contracts/service";
import { endpoint } from "@/lib/http";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) { return endpoint(async () => {
  const owner = await requireUser(req), { id } = await ctx.params;
  const run = await triggerRun(id, owner, req.headers.get("idempotency-key") ?? undefined);
  return Response.json({ runId: run!.id, state: run!.state }, { status: 202, headers: { Location: `/api/runs/${run!.id}` } });
}); }
