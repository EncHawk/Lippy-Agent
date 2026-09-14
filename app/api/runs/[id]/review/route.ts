import { z } from "zod";
import { requireUser } from "@/lib/auth/service";
import { reviewRun } from "@/lib/contracts/service";
import { endpoint, body } from "@/lib/http";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) { return endpoint(async () => {
  const owner = await requireUser(req), { decision } = z.object({ decision: z.enum(["accept", "reject"]) }).parse(await body(req));
  return Response.json({ run: await reviewRun((await ctx.params).id, owner, decision) });
}); }
