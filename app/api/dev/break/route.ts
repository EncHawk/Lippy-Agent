import { NextResponse } from "next/server";
import { breakMockForDemo } from "@/lib/brightdata/client";

/**
 * Demo-only endpoint: forces the next run to violate so the heal cycle
 * fires on cue. No-op when real API keys are configured (mock mode
 * requires no keys, real mode doesn't need this knob). Not part of the
 * MCP surface — purely a live-demo convenience.
 */
export async function POST() {
  const applied = breakMockForDemo();
  return NextResponse.json({ applied });
}
