import { z } from "zod";
import { buildRuntimeValidator, type ContractField } from "./schema";

export type FieldViolation = {
  key: string;
  expectedType: ContractField["type"];
  received: unknown;
  message: string;
};

export type ValidationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; violations: FieldViolation[] };

/**
 * Validates a raw extraction result against a contract's field list.
 *
 * This is the function the whole product hinges on: it's the difference
 * between "the scraper ran" and "the contract still holds." A run can
 * produce HTTP 200 and non-empty JSON and still fail here — e.g. a
 * redesigned page where `.price` now resolves to a promotional banner's
 * text instead of a number. That's exactly the class of failure schema
 * validation catches that a naive "did we get a response" health check
 * would miss.
 */
export function validateAgainstContract(
  fields: ContractField[],
  raw: unknown,
): ValidationResult {
  const validator = buildRuntimeValidator(fields);
  const result = validator.safeParse(raw);

  if (result.success) {
    return { ok: true, data: result.data };
  }

  const violations = fieldViolationsFromZodError(result.error, fields, raw);
  return { ok: false, violations };
}

function fieldViolationsFromZodError(
  error: z.ZodError,
  fields: ContractField[],
  raw: unknown,
): FieldViolation[] {
  const fieldByKey = new Map(fields.map((f) => [f.key, f]));
  const rawRecord = isRecord(raw) ? raw : {};

  return error.issues.map((issue) => {
    const key = String(issue.path[0] ?? "unknown");
    const field = fieldByKey.get(key);
    return {
      key,
      expectedType: field?.type ?? "string",
      received: rawRecord[key],
      message: issue.message,
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True if the run is fully clean — used to decide healthy vs degraded/broken status. */
export function isFullyValid(result: ValidationResult): result is { ok: true; data: Record<string, unknown> } {
  return result.ok;
}
