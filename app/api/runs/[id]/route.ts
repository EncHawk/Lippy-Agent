import { requireUser } from "@/lib/auth/service";
import { getRun } from "@/lib/contracts/service";
import { endpoint } from "@/lib/http";
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) { return endpoint(async () => Response.json({ run: await getRun((await ctx.params).id, await requireUser(req)) })); }
