import { NextRequest, NextResponse } from "next/server";
import { createContract, listContracts } from "@/lib/contracts/service";
import { toErrorResponse } from "@/lib/errors";

/**
 * GET  /api/contracts           -> list all contracts (dashboard feed)
 * POST /api/contracts           -> create a new contract from { url, fields, pollIntervalMs? }
 *
 * Both handlers are intentionally thin: parse input, call a service
 * function, shape the response. All validation and side effects live in
 * `lib/contracts/service.ts` so the MCP `create_contract` tool and the
 * HTTP POST route can never drift.
 */

export async function GET() {
  try {
    const contracts = await listContracts();
    return NextResponse.json({ contracts });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const contract = await createContract(body);
    return NextResponse.json({ contract }, { status: 201 });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
