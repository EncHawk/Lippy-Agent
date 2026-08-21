"use client";

import { useState } from "react";

/**
 * Posts to /api/contracts/:id/run and reflects the orchestrator's outcome
 * on the button. The actual live updates (violations, heals, field
 * changes) come through the EventFeed via SSE — this button is just the
 * trigger.
 */
export function RunButton({ contractId }: { contractId: string }) {
  const [state, setState] = useState<"idle" | "running" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onClick() {
    setState("running");
    setMessage(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/run`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setState("error");
        setMessage(json?.error?.message ?? "Run failed");
        return;
      }
      setState("idle");
      setMessage(
        `Outcome: ${json.result?.outcome ?? "unknown"}${json.result?.fieldChanges?.length ? `, ${json.result.fieldChanges.length} field change(s)` : ""}`,
      );
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Network error");
    }
  }

  return (
    <div className="run-control">
      <button
        type="button"
        onClick={onClick}
        disabled={state === "running"}
        className="run-button"
      >
        {state === "running" ? "Running…" : "Run now"}
      </button>
      {message && (
        <span className={`run-message ${state === "error" ? "run-error" : ""}`}>
          {message}
        </span>
      )}
    </div>
  );
}
