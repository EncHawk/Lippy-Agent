import { z } from "zod";
import { requireUser } from "@/lib/auth/service";
import { reconcileRun } from "@/lib/contracts/service";
import { endpoint, body } from "@/lib/http";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) { return endpoint(async () => {
  const owner = await requireUser(req), input = z.object({ note: z.string().min(10).max(2000), collectorId: z.string().optional() }).parse(await body(req));
  return Response.json(await reconcileRun((await ctx.params).id, owner, input.note, input.collectorId));
}); }
