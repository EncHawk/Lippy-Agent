import type { ContractField } from "../contracts/schema";
export type FieldChange = { field: string; previousValue: unknown; currentValue: unknown; confidence: number; summary: string; reviewRequired: boolean };
function canonical(value: unknown, field: ContractField): unknown {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  let result = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (field.type === "url") { const url = new URL(result); url.hash = ""; url.searchParams.sort(); return url.toString(); }
  if (field.ignoreCase) result = result.toLowerCase();
  return result;
}
/** Deterministic meaning under the contract's explicit normalization and change policy. */
export function diffFields(fields: ContractField[], previous: Record<string, unknown> | null, current: Record<string, unknown>): FieldChange[] {
  if (!previous) return [];
  return fields.flatMap(field => {
    const before = previous[field.key], after = current[field.key];
    if (canonical(before, field) === canonical(after, field)) return [];
    let reviewRequired = false;
    if (field.maxRelativeChange !== undefined && typeof before === "number" && typeof after === "number") {
      reviewRequired = before === 0 ? after !== 0 : Math.abs((after - before) / before) > field.maxRelativeChange;
    }
    return [{ field: field.key, previousValue: before ?? null, currentValue: after ?? null, confidence: 1,
      summary: `${field.key}: ${JSON.stringify(before ?? null)} → ${JSON.stringify(after ?? null)}`,
      reviewRequired }];
  });
}
