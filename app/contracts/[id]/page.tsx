import { notFound } from "next/navigation";
import Link from "next/link";
import { getContractWithHistory } from "@/lib/contracts/service";
import type { ContractField } from "@/lib/contracts/schema";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { RunButton } from "@/components/dashboard/RunButton";
import { EventFeed } from "@/components/dashboard/EventFeed";
import { LineageGraph } from "@/components/dashboard/LineageGraph";

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
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/dashboard" className="text-xs text-neutral-500 hover:text-neutral-700">
        ← All contracts
      </Link>

      <header className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="break-all text-xl font-semibold text-neutral-900">{contract.url}</h1>
          <p className="mt-1 text-xs text-neutral-500">
            id <code className="rounded bg-neutral-100 px-1 py-0.5">{contract.id}</code>
            {" · "}
            collector <code className="rounded bg-neutral-100 px-1 py-0.5">{contract.collectorId ?? "—"}</code>
            {" · "}
            poll every {Math.round(contract.pollIntervalMs / 1000)}s
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={contract.status} />
          <RunButton contractId={contract.id} />
        </div>
      </header>

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-neutral-200">
          <div className="border-b border-neutral-200 px-4 py-2">
            <h3 className="text-sm font-medium text-neutral-900">Schema</h3>
          </div>
          <ul className="divide-y divide-neutral-100">
            {fields.map((f) => (
              <li key={f.key} className="flex items-center justify-between px-4 py-2 text-sm">
                <div>
                  <span className="font-mono font-medium text-neutral-900">{f.key}</span>
                  <span className="ml-2 text-xs text-neutral-500">{f.type}</span>
                  {f.required && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-red-600">required</span>
                  )}
                </div>
                {lastValidated && (
                  <span className="font-mono text-xs text-neutral-700">
                    {JSON.stringify(lastValidated[f.key])}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <EventFeed contractId={contract.id} />
      </section>

      <section className="mt-6">
        <LineageGraph runs={runs} events={events} />
      </section>
    </main>
  );
}
