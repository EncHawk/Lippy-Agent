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
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={state === "running"}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {state === "running" ? "Running…" : "Run now"}
      </button>
      {message && (
        <span className={`text-xs ${state === "error" ? "text-red-600" : "text-neutral-600"}`}>
          {message}
        </span>
      )}
    </div>
  );
}
