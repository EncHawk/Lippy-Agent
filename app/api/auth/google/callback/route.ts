import { NextResponse } from "next/server";
import { completeGoogleLogin, cookie, cookieOptions, STATE_COOKIE, SESSION_COOKIE } from "@/lib/auth/service";
import { endpoint } from "@/lib/http";
import { env } from "@/lib/env";
export async function GET(req: Request) { return endpoint(async () => {
  const url = new URL(req.url);
  const session = await completeGoogleLogin(url.searchParams.get("code") ?? "", url.searchParams.get("state") ?? "", cookie(req, STATE_COOKIE));
  const response = NextResponse.redirect(`${env.APP_URL}/api/auth/me`);
  response.cookies.set(SESSION_COOKIE, session.token, { ...cookieOptions, expires: session.expiresAt });
  response.cookies.set(STATE_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return response;
}); }
