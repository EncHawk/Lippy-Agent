import { NextResponse } from "next/server";
import { triggerRun } from "@/lib/contracts/service";
import { toErrorResponse } from "@/lib/errors";

/**
 * POST /api/contracts/:id/run -> kicks off the orchestrator loop
 * (extract -> validate -> heal if needed -> semantic-diff -> emit).
 *
 * Returns 202 Accepted with a small status payload. The full event stream
 * is available at GET /api/contracts/:id/events for clients that want to
 * follow the run live.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const result = await triggerRun(id);
    return NextResponse.json({ status: "ok", result }, { status: 202 });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
