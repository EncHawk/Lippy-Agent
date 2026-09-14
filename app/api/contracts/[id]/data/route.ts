import { requireUser } from "@/lib/auth/service";
import { getData } from "@/lib/contracts/service";
import { endpoint } from "@/lib/http";
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) { return endpoint(async () => Response.json(await getData((await ctx.params).id, await requireUser(req)))); }
