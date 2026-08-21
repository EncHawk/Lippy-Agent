"use client";

import { useEffect, useState } from "react";

type Event = {
  type: string;
  contractId: string;
  runId?: string;
  field?: string;
  previousValue?: unknown;
  currentValue?: unknown;
  confidence?: number;
  summary?: string;
  reason?: string;
  attempts?: number;
  attempt?: number;
  ts?: string;
};

const TYPE_STYLES: Record<string, string> = {
  "contract.violated": "bg-red-50 text-red-800 border-red-200",
  "contract.healing": "bg-blue-50 text-blue-800 border-blue-200",
  "contract.healed": "bg-emerald-50 text-emerald-800 border-emerald-200",
  "contract.escalated": "bg-red-100 text-red-900 border-red-300",
  "field.changed": "bg-amber-50 text-amber-800 border-amber-200",
};

/**
 * Live event feed for a single contract. Opens an EventSource to the SSE
 * route and appends each frame to a rolling log. The orchestrator pushes
 * typed events; we render a one-line summary per event type.
 */
export function EventFeed({ contractId }: { contractId: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource(`/api/contracts/${contractId}/events`);

    source.addEventListener("open", () => setConnected(true));
    source.addEventListener("error", () => setConnected(false));

    const handler = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as Event;
        setEvents((prev) => [{ ...parsed, ts: new Date().toISOString() }, ...prev].slice(0, 50));
      } catch {
        // Ignore malformed frames.
      }
    };

    source.onmessage = handler;
    return () => source.close();
  }, [contractId]);

  return (
    <div className="rounded-lg border border-neutral-200">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
        <h3 className="text-sm font-medium text-neutral-900">Live events</h3>
        <span className={`flex items-center gap-1.5 text-xs ${connected ? "text-emerald-700" : "text-neutral-500"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-neutral-400"}`} />
          {connected ? "connected" : "disconnected"}
        </span>
      </div>
      <ul className="max-h-80 overflow-y-auto divide-y divide-neutral-100">
        {events.length === 0 && (
          <li className="px-4 py-3 text-sm text-neutral-500">
            Waiting for events. Click <span className="font-medium">Run now</span> to trigger a cycle.
          </li>
        )}
        {events.map((event, i) => (
          <li key={i} className="px-4 py-2 text-sm">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${TYPE_STYLES[event.type] ?? "bg-neutral-100 text-neutral-700 border-neutral-200"}`}
              >
                {event.type}
              </span>
              {event.attempt !== undefined && (
                <span className="text-xs text-neutral-500">attempt {event.attempt}</span>
              )}
              <span className="ml-auto text-[11px] text-neutral-400">{event.ts?.slice(11, 19)}</span>
            </div>
            {event.summary && <p className="mt-1 text-xs text-neutral-700">{event.summary}</p>}
            {event.reason && <p className="mt-1 text-xs text-red-700">{event.reason}</p>}
            {event.type === "field.changed" && (
              <p className="mt-1 text-xs text-neutral-700">
                {event.field}: {String(event.previousValue)} → {String(event.currentValue)}
                {event.confidence !== undefined && (
                  <span className="ml-2 text-neutral-500">confidence {event.confidence.toFixed(2)}</span>
                )}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
