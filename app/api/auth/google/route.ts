import { NextResponse } from "next/server";
import { beginGoogleLogin, STATE_COOKIE, cookieOptions } from "@/lib/auth/service";
import { endpoint } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() { return endpoint(async () => {
  const login = await beginGoogleLogin();
  const response = NextResponse.redirect(login.url);
  response.cookies.set(STATE_COOKIE, login.state, { ...cookieOptions, maxAge: 600 });
  return response;
}); }
