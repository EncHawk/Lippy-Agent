import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { db } from "../db";
import { env } from "../env";
import { HttpError } from "../errors";
export const SESSION_COOKIE = "lippy_session";
export const STATE_COOKIE = "lippy_oauth_state";
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const randomToken = () => randomBytes(32).toString("base64url");
export const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: new URL(env.APP_URL).protocol === "https:", path: "/" };
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
export function cookie(req: Request, name: string) {
  return req.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith(`${name}=`))?.slice(name.length + 1);
}
export async function requireUser(req: Request): Promise<string> {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(env.APP_URL).origin) throw new HttpError(403, "ORIGIN_DENIED", "Cross-origin requests are not allowed");
  const authorization = req.headers.get("authorization");
  const token = authorization ? /^Bearer ([A-Za-z0-9_-]+)$/.exec(authorization)?.[1] : cookie(req, SESSION_COOKIE);
  // Explicit, isolated local mode. Never permit a production auth bypass.
  if (!authorization && !token && env.AUTH_MODE === "development" && env.NODE_ENV !== "production") {
    const user = await db.user.upsert({ where: { id: "local-developer" }, create: { id: "local-developer", email: "developer@localhost" }, update: {} });
    return user.id;
  }
  if (!token) throw new HttpError(401, "UNAUTHENTICATED", "Sign in with Google or supply a valid API token");
  if (!authorization && !["GET", "HEAD", "OPTIONS"].includes(req.method) && origin !== new URL(env.APP_URL).origin)
    throw new HttpError(403, "ORIGIN_REQUIRED", "Cookie-authenticated writes require the application Origin header");
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session || session.expiresAt <= new Date() || (authorization && session.kind !== "api"))
    throw new HttpError(401, "UNAUTHENTICATED", "Invalid or expired credentials");
  return session.userId;
}
export async function issueToken(userId: string, kind: "api" | "session") {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + (kind === "api" ? 30 : 7) * 86400000);
  const session = await db.session.create({ data: { userId, kind, tokenHash: hashToken(token), expiresAt } });
  return { token, expiresAt, id: session.id };
}
function requireGoogle() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new HttpError(503, "AUTH_NOT_CONFIGURED", "Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
  if (env.NODE_ENV === "production" && new URL(env.APP_URL).protocol !== "https:") throw new HttpError(503, "AUTH_NOT_CONFIGURED", "Production APP_URL must use HTTPS");
  return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
}
export async function beginGoogleLogin() {
  const { clientId } = requireGoogle();
  const state = randomToken(), verifier = randomToken(), nonce = randomToken();
  await db.oAuthAttempt.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.oAuthAttempt.create({ data: { stateHash: hashToken(state), verifier, nonce, expiresAt: new Date(Date.now() + 600000) } });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: `${env.APP_URL}/api/auth/google/callback`, response_type: "code", scope: "openid email", state, nonce,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
  return { state, url: url.toString() };
}
export async function completeGoogleLogin(code: string, state: string, cookieState: string | undefined) {
  const { clientId, clientSecret } = requireGoogle();
  if (!state || state !== cookieState) throw new HttpError(400, "INVALID_STATE", "OAuth state mismatch");
  const attempt = await db.oAuthAttempt.findUnique({ where: { stateHash: hashToken(state) } });
  if (!attempt || attempt.expiresAt <= new Date()) throw new HttpError(400, "INVALID_STATE", "OAuth login expired");
  const consumed = await db.oAuthAttempt.deleteMany({ where: { stateHash: attempt.stateHash } });
  if (!consumed.count) throw new HttpError(400, "INVALID_STATE", "OAuth login already used");
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: `${env.APP_URL}/api/auth/google/callback`, grant_type: "authorization_code", code_verifier: attempt.verifier }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new HttpError(401, "GOOGLE_LOGIN_FAILED", "Google rejected the authorization code");
  const tokens = z.object({ id_token: z.string() }).parse(await response.json());
  const { payload } = await jwtVerify(tokens.id_token, jwks, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: clientId, algorithms: ["RS256"], requiredClaims: ["sub", "exp", "iat", "nonce"] });
  if ((payload.azp !== undefined && payload.azp !== clientId) || payload.nonce !== attempt.nonce || payload.email_verified !== true || !payload.sub || typeof payload.email !== "string")
    throw new HttpError(401, "GOOGLE_LOGIN_FAILED", "Invalid Google identity");
  const user = await db.user.upsert({ where: { googleSub: payload.sub }, create: { googleSub: payload.sub, email: payload.email }, update: { email: payload.email } });
  return issueToken(user.id, "session");
}
