import { StatusBadge } from "@/components/dashboard/StatusBadge";

type Run = {
  id: string;
  startedAt: string | Date;
  finishedAt: string | Date | null;
  outcome: string | null;
};

type Event = {
  id: string;
  type: string;
  createdAt: string | Date;
};

/**
 * Lineage view: most-recent-first vertical timeline of every run with its
 * outcome, plus the events that fired during each run. Static in the
 * sense that it's read-only (no interactivity) but driven by real data
 * from the DB. This is the "is my contract still alive?" surface for a
 * judge clicking through.
 */
export function LineageGraph({ runs, events }: { runs: Run[]; events: Event[] }) {
  const eventsByRunId = new Map<string, Event[]>();
  for (const e of events) {
    // Events don't currently carry runId in the persisted payload column,
    // so we fall back to a coarse time-window match per run.
    const evTime = new Date(e.createdAt).getTime();
    const run = runs.find((r) => {
      const start = new Date(r.startedAt).getTime();
      const end = r.finishedAt ? new Date(r.finishedAt).getTime() : Date.now();
      return evTime >= start && evTime <= end + 5_000;
    });
    if (!run) continue;
    const bucket = eventsByRunId.get(run.id) ?? [];
    bucket.push(e);
    eventsByRunId.set(run.id, bucket);
  }

  return (
    <div className="data-panel history-panel">
      <div className="data-panel-heading"><h3>Run history</h3><span className="mono-label">LINEAGE</span></div>
      <ol className="history-list">
        {runs.length === 0 && (
          <li className="history-empty">No runs yet.</li>
        )}
        {runs.map((run) => (
          <li key={run.id} className="history-row">
            <div className="history-main">
              <div className="history-date">
                {new Date(run.startedAt).toISOString().slice(0, 19).replace("T", " ")}
              </div>
              {run.outcome && <StatusBadge status={run.outcome} />}
            </div>
            <span className="history-events">
              {(eventsByRunId.get(run.id) ?? []).length} event(s)
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
