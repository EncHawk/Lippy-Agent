import { NextResponse } from "next/server";
import { toErrorResponse, HttpError } from "./errors";
export async function endpoint(action: () => Promise<Response>) {
  try { return await action(); }
  catch (error) { const { status, body } = toErrorResponse(error); return NextResponse.json(body, { status }); }
}
export async function body(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > 65536) throw new HttpError(413, "BODY_TOO_LARGE", "Maximum request body is 64 KiB");
  try { return JSON.parse(text); } catch { throw new HttpError(400, "INVALID_JSON", "Malformed JSON body"); }
}
export function cursor(value: string | null) {
  if (value === null || value === "") return 0n;
  if (!/^\d{1,18}$/.test(value)) throw new HttpError(400, "INVALID_CURSOR", "Use the event sequence as the cursor");
  return BigInt(value);
}
