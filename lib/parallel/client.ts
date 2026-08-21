import { env, isMockParallel } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import type { ContractField } from "@/lib/contracts/schema";

const log = createLogger("parallel-client");

/**
 * Semantic-diff client. Parallel AI's job is to answer "did this field's
 * value change in a *meaningful* way?" — not just "are the strings
 * different?". Two prices that differ only in formatting ("$1,299" vs
 * "1299.00") are not a semantic change; a price that dropped 20% is.
 *
 * Mirrors `BrightDataClient`'s shape so swapping mock for live HTTP is a
 * single-file change. In mock mode we approximate with a strict-equality
 * check, which is enough to exercise the wiring during the demo.
 */
export type FieldDiffInput = {
  field: string;
  type: ContractField["type"];
  previousValue: unknown;
  currentValue: unknown;
};

export type FieldDiffResult = {
  changed: boolean;
  confidence: number;
  summary: string;
};

export class ParallelClient {
  private readonly mock = isMockParallel;

  async diffField(input: FieldDiffInput): Promise<FieldDiffResult> {
    if (this.mock) {
      return mockDiffField(input);
    }
    return this.request<FieldDiffResult>("/v1/diff/field", input);
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${env.PARALLEL_API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.PARALLEL_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      log.warn("parallel request failed, returning no-change", { path, status: res.status });
      return { changed: false, confidence: 0, summary: "" } as T;
    }
    return res.json() as Promise<T>;
  }
}

export const parallel = new ParallelClient();

function mockDiffField(input: FieldDiffInput): FieldDiffResult {
  const { field, previousValue, currentValue, type } = input;

  // No previous value (first run) -> never a semantic change, just initialization.
  if (previousValue === undefined || previousValue === null) {
    return { changed: false, confidence: 1, summary: "" };
  }

  const samePrimitive = previousValue === currentValue;
  if (samePrimitive) {
    return { changed: false, confidence: 1, summary: "" };
  }

  // For numeric fields, surface the magnitude of the change as the summary.
  // This is the bit the demo script leans on: "price dropped by 12%".
  if (type === "number" && typeof previousValue === "number" && typeof currentValue === "number") {
    const delta = currentValue - previousValue;
    const pct = previousValue === 0 ? 0 : (delta / previousValue) * 100;
    const direction = delta < 0 ? "decreased" : "increased";
    return {
      changed: true,
      confidence: 0.9,
      summary: `${field} ${direction} by ${Math.abs(pct).toFixed(1)}% (${previousValue} -> ${currentValue})`,
    };
  }

  return {
    changed: true,
    confidence: 0.85,
    summary: `${field} changed from ${JSON.stringify(previousValue)} to ${JSON.stringify(currentValue)}`,
  };
}
