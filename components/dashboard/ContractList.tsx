"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "./StatusBadge";

type Contract = {
  id: string;
  url: string;
  status: string;
  createdAt: string;
};

export function ContractList() {
  const [contracts, setContracts] = useState<Contract[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/contracts")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setContracts(json.contracts);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (contracts === null) {
    return <p className="text-sm text-neutral-500">Loading contracts…</p>;
  }

  if (contracts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center">
        <p className="text-sm text-neutral-600">No contracts yet.</p>
        <p className="mt-1 text-sm text-neutral-500">Define a URL and a schema to start one.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
      {contracts.map((c) => (
        <li key={c.id}>
          <Link href={`/contracts/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-100">
            <div>
              <p className="font-medium text-neutral-900">{c.url}</p>
              <p className="text-xs text-neutral-500">{c.id}</p>
            </div>
            <StatusBadge status={c.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
