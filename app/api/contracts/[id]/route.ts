import { NextResponse } from "next/server";
import { getContract, getContractHistory } from "@/lib/contracts/service";
import { toErrorResponse } from "@/lib/errors";

/**
 * GET /api/contracts/:id -> contract metadata + recent runs + recent events.
 * Bundles history with the contract so the detail page can render in one
 * fetch instead of three.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const [contract, history] = await Promise.all([getContract(id), getContractHistory(id)]);
    return NextResponse.json({ contract, ...history });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
