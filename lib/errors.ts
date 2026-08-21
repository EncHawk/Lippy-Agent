import { ZodError } from "zod";

/**
 * Typed errors instead of thrown strings. Every error the app raises on
 * purpose extends AppError and carries an HTTP status plus a stable,
 * machine-readable `code` — so API routes can map errors to responses in one
 * place (see the `toResponse` helper) instead of duplicating `try/catch`
 * shaping logic in every handler.
 */
export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;

  constructor(message: string, override readonly cause?: unknown) {
    super(message);
    this.name = new.target.name;
  }
}

export class ContractNotFoundError extends AppError {
  readonly status = 404;
  readonly code = "CONTRACT_NOT_FOUND";
  constructor(contractId: string) {
    super(`No contract found with id "${contractId}".`);
  }
}

export class InvalidContractSchemaError extends AppError {
  readonly status = 400;
  readonly code = "INVALID_CONTRACT_SCHEMA";
}

export class ExtractionFailedError extends AppError {
  readonly status = 502;
  readonly code = "EXTRACTION_FAILED";
  constructor(url: string, cause?: unknown) {
    super(`Extraction failed for "${url}".`, cause);
  }
}

export class HealExhaustedError extends AppError {
  readonly status = 502;
  readonly code = "HEAL_EXHAUSTED";
  constructor(contractId: string, attempts: number) {
    super(
      `Self-healing exhausted after ${attempts} attempt(s) for contract "${contractId}". Escalating.`,
    );
  }
}

export class RunAlreadyInFlightError extends AppError {
  readonly status = 409;
  readonly code = "RUN_ALREADY_IN_FLIGHT";
  constructor(contractId: string) {
    super(`A run is already in progress for contract "${contractId}".`);
  }
}

/** Maps any thrown error to a JSON-serializable API response shape. */
export function toErrorResponse(err: unknown): { status: number; body: { error: { code: string; message: string } } } {
  if (err instanceof AppError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message } } };
  }
  // Zod validation failures from schema.parse() calls in services — surface
  // them as 400s with the validator's per-field messages rather than as
  // generic 500s, so clients can render the actual issue.
  if (err instanceof ZodError) {
    const fieldMessages = err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    return {
      status: 400,
      body: { error: { code: "INVALID_INPUT", message: fieldMessages } },
    };
  }
  console.error("Unhandled error:", err);
  return {
    status: 500,
    body: { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
  };
}
