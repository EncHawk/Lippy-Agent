import { notFound } from "next/navigation";
import Link from "next/link";
import { getContractWithHistory } from "@/lib/contracts/service";
import type { ContractField } from "@/lib/contracts/schema";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { RunButton } from "@/components/dashboard/RunButton";
import { EventFeed } from "@/components/dashboard/EventFeed";
import { LineageGraph } from "@/components/dashboard/LineageGraph";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";

/**
 * /contracts/:id — the per-contract detail page.
 *
 * Server-rendered so the initial paint already shows current state (no
 * skeleton flash); the EventFeed client component then takes over the
 * live updates via SSE. One service call = one DB round trip, which
 * matters a lot when the database is remote (Neon) and every query is
 * network latency.
 */
export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let data;
  try {
    data = await getContractWithHistory(id);
  } catch {
    notFound();
  }
  const { contract, runs, events } = data;

  const fields: ContractField[] = JSON.parse(contract.schema);
  const lastValidated: Record<string, unknown> | null = runs[0]?.validated
    ? JSON.parse(runs[0].validated)
    : null;

  return (
    <main className="app-shell">
      <div className="app-frame app-detail-frame">
        <AppHeader />
        <Link href="/dashboard" className="app-back-link">← All contracts</Link>

        <header className="detail-header">
          <div>
            <p className="app-eyebrow"><i /> CONTRACT / LIVE SURFACE</p>
            <h1>{contract.url}</h1>
            <p className="detail-meta">
              id <code>{contract.id}</code>
              {" · "}
              collector <code>{contract.collectorId ?? "—"}</code>
              {" · "}
              poll every {Math.round(contract.pollIntervalMs / 1000)}s
            </p>
          </div>
          <div className="detail-actions">
            <StatusBadge status={contract.status} />
            <RunButton contractId={contract.id} />
          </div>
        </header>

        <section className="detail-grid">
          <div className="data-panel">
            <div className="data-panel-heading"><h3>Schema</h3><span className="mono-label">CONTRACT.JSON</span></div>
            <ul className="data-list">
            {fields.map((f) => (
              <li key={f.key}>
                <div>
                  <span className="data-key">{f.key}</span>
                  <span className="data-type">{f.type}</span>
                  {f.required && (
                    <span className="data-required">required</span>
                  )}
                </div>
                {lastValidated && (
                  <span className="data-value">
                    {JSON.stringify(lastValidated[f.key])}
                  </span>
                )}
              </li>
            ))}
          </ul>
          </div>

          <EventFeed contractId={contract.id} />
        </section>

        <section className="detail-history">
          <LineageGraph runs={runs} events={events} />
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
