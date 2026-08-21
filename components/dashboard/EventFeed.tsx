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
  "contract.violated": "event-violated",
  "contract.healing": "event-healing",
  "contract.healed": "event-healed",
  "contract.escalated": "event-escalated",
  "field.changed": "event-changed",
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
    <div className="data-panel event-panel">
      <div className="data-panel-heading"><h3>Live events</h3>
        <span className={`event-connection ${connected ? "connected" : ""}`}>
          <span className="status-dot" />
          {connected ? "connected" : "disconnected"}
        </span>
      </div>
      <ul className="event-list">
        {events.length === 0 && (
          <li className="event-empty">
            Waiting for events. Click <strong>Run now</strong> to trigger a cycle.
          </li>
        )}
        {events.map((event, i) => (
          <li key={i} className="event-row">
            <div className="event-row-top">
              <span
                className={`event-type ${TYPE_STYLES[event.type] ?? "event-default"}`}
              >
                {event.type}
              </span>
              {event.attempt !== undefined && (
                <span className="event-attempt">attempt {event.attempt}</span>
              )}
              <span className="event-time">{event.ts?.slice(11, 19)}</span>
            </div>
            {event.summary && <p className="event-summary">{event.summary}</p>}
            {event.reason && <p className="event-reason">{event.reason}</p>}
            {event.type === "field.changed" && (
              <p className="event-summary">
                {event.field}: {String(event.previousValue)} → {String(event.currentValue)}
                {event.confidence !== undefined && (
                  <span className="event-confidence">confidence {event.confidence.toFixed(2)}</span>
                )}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
