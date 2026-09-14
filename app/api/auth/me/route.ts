import { requireUser } from "@/lib/auth/service";
import { db } from "@/lib/db";
import { endpoint } from "@/lib/http";
export async function GET(req: Request) { return endpoint(async () => Response.json({ user: await db.user.findUnique({ where: { id: await requireUser(req) }, select: { id: true, email: true } }) }, { headers: { "Cache-Control": "no-store" } })); }
