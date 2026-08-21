import type { FieldViolation } from "@/lib/contracts/validator";

/**
 * One discriminated union for "what happened" — emitted by the orchestrator,
 * persisted by the bus, fanned out to SSE subscribers and webhook
 * deliveries. The shape is the source of truth, so every consumer parses
 * the same way. The `type` literal acts as the discriminator.
 */

export type SelectorDiff = {
  field: string;
  oldSelector?: string;
  newSelector: string;
};

export type ContractEvent =
  | {
      type: "contract.violated";
      contractId: string;
      runId: string;
      violations: FieldViolation[];
    }
  | {
      type: "contract.healing";
      contractId: string;
      runId: string;
      attempt: number;
    }
  | {
      type: "contract.healed";
      contractId: string;
      runId: string;
      attempt: number;
      selectorDiff: SelectorDiff[] | undefined;
    }
  | {
      type: "contract.escalated";
      contractId: string;
      runId: string;
      attempts: number;
      reason: string;
    }
  | {
      type: "field.changed";
      contractId: string;
      runId: string;
      field: string;
      previousValue: unknown;
      currentValue: unknown;
      confidence: number;
      summary: string;
    };

export type ContractEventType = ContractEvent["type"];
