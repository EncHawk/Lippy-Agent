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
    return <p className="app-loading">Loading contracts...</p>;
  }

  if (contracts.length === 0) {
    return (
      <div className="app-empty-state">
        <p>No contracts yet.</p>
        <p>Define a URL and a schema to start one.</p>
      </div>
    );
  }

  return (
    <ul className="contract-list">
      {contracts.map((c) => (
        <li key={c.id}>
          <Link href={`/contracts/${c.id}`} className="contract-row">
            <div>
              <p className="contract-url">{c.url}</p>
              <p className="contract-id">{c.id}</p>
            </div>
            <StatusBadge status={c.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
