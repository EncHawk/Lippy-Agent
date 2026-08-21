/**
 * Skeletons used by the loading.tsx route files. Kept in one component
 * file so the shimmer styling lives in exactly one place.
 */
export function ContractListSkeleton() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="h-8 w-40 animate-pulse rounded bg-neutral-200" />
      <div className="mt-2 h-4 w-72 animate-pulse rounded bg-neutral-100" />
      <ul className="mt-8 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center justify-between px-4 py-3">
            <div className="space-y-2">
              <div className="h-4 w-56 animate-pulse rounded bg-neutral-200" />
              <div className="h-3 w-32 animate-pulse rounded bg-neutral-100" />
            </div>
            <div className="h-6 w-20 animate-pulse rounded-full bg-neutral-200" />
          </li>
        ))}
      </ul>
    </main>
  );
}

export function ContractDetailSkeleton() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="h-3 w-24 animate-pulse rounded bg-neutral-100" />
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-80 animate-pulse rounded bg-neutral-200" />
          <div className="h-3 w-64 animate-pulse rounded bg-neutral-100" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="h-6 w-20 animate-pulse rounded-full bg-neutral-200" />
          <div className="h-8 w-24 animate-pulse rounded-md bg-neutral-300" />
        </div>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-neutral-200 p-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 w-28 animate-pulse rounded bg-neutral-200" />
              <div className="h-4 w-16 animate-pulse rounded bg-neutral-100" />
            </div>
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50" />
      </div>
      <div className="mt-6 h-40 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50" />
    </main>
  );
}
