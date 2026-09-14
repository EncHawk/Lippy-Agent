import { NextResponse } from "next/server";
import { requireUser, cookie, SESSION_COOKIE, hashToken, cookieOptions } from "@/lib/auth/service";
import { db } from "@/lib/db";
import { endpoint } from "@/lib/http";
export async function POST(req: Request) { return endpoint(async () => {
  const userId = await requireUser(req), token = cookie(req, SESSION_COOKIE);
  if (token) await db.session.deleteMany({ where: { userId, tokenHash: hashToken(token) } });
  const response = NextResponse.json({ signedOut: true });
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 }); return response;
}); }
