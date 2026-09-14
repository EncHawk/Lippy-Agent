import { z } from "zod";
import { requireUser } from "@/lib/auth/service";
import { getContract, getContractHistory, setEnabled } from "@/lib/contracts/service";
import { endpoint, body } from "@/lib/http";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, ctx: Context) { return endpoint(async () => {
  const owner = await requireUser(req), { id } = await ctx.params;
  return Response.json({ contract: await getContract(id, owner), ...await getContractHistory(id, owner) });
}); }
export async function PATCH(req: Request, ctx: Context) { return endpoint(async () => {
  const owner = await requireUser(req), { id } = await ctx.params;
  const { enabled } = z.object({ enabled: z.boolean() }).parse(await body(req));
  return Response.json({ contract: await setEnabled(id, owner, enabled) });
}); }
