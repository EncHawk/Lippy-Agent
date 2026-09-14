import { z } from "zod";
import { requireUser, issueToken } from "@/lib/auth/service";
import { db } from "@/lib/db";
import { endpoint, body } from "@/lib/http";
export async function POST(req: Request) { return endpoint(async () => Response.json(await issueToken(await requireUser(req), "api"), { status: 201, headers: { "Cache-Control": "no-store" } })); }
export async function DELETE(req: Request) { return endpoint(async () => {
  const owner = await requireUser(req), { id } = z.object({ id: z.string() }).parse(await body(req));
  await db.session.deleteMany({ where: { id, userId: owner, kind: "api" } });
  return new Response(null, { status: 204 });
}); }
