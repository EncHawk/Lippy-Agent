import { ContractList } from "@/components/dashboard/ContractList";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Contracts</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Every contract you've defined, with its current health and a link into the detail view.
          </p>
        </div>
        <a href="/" className="text-xs text-neutral-500 hover:text-neutral-700">
          ← Home
        </a>
      </div>
      <div className="mt-8">
        <ContractList />
      </div>
    </main>
  );
}
