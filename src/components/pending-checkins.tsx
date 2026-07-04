"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

// ---------------------------------------------------------------------------
// The waiter-venue surface: a live list of check-ins waiting for a human.
// Confirm straight from the row (dropping the bill, sweeping during a lull).
// Polls gently; also refreshable by the console confirming a code.
// ---------------------------------------------------------------------------

type PendingRow = {
  code: string;
  rawCode: string;
  tableNumber: string | null;
  createdAt: string;
  customer: {
    firstName: string;
    lastName: string | null;
    totalVisits: number;
  } | null;
};

function age(createdAt: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export function PendingCheckins({ big = false }: { big?: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<PendingRow[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/counter/pending");
      if (!res.ok) return;
      const data = await res.json();
      setRows(data.pending as PendingRow[]);
    } catch {
      // polling — stay quiet, next tick retries
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function confirm(rawCode: string) {
    setConfirming(rawCode);
    setError(null);
    try {
      const res = await fetch(
        `/api/counter/codes/${encodeURIComponent(rawCode)}/confirm`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not confirm");
      }
      await load();
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setConfirming(null);
    }
  }

  if (rows === null) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="app-shimmer h-12 rounded-xl" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-ink-faint">
        No check-ins waiting. ☕
      </p>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-ink/5">
        {rows.map((row) => (
          <li
            key={row.rawCode}
            className="flex items-center justify-between gap-3 py-2.5"
          >
            <div className="min-w-0">
              <p className={`font-semibold text-ink ${big ? "text-base" : "text-sm"}`}>
                {row.tableNumber ? (
                  <span className="mr-2 rounded-md bg-ink px-1.5 py-0.5 text-xs font-bold text-white">
                    T{row.tableNumber}
                  </span>
                ) : null}
                {row.customer
                  ? [row.customer.firstName, row.customer.lastName]
                      .filter(Boolean)
                      .join(" ")
                  : "Guest"}
                {row.customer ? (
                  <span className="ml-1.5 text-xs font-normal text-ink-faint">
                    visit #{row.customer.totalVisits + 1}
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-ink-faint">
                <span className="font-mono">{row.code}</span> · {age(row.createdAt)}
              </p>
            </div>
            <Button
              size={big ? "md" : "sm"}
              onClick={() => confirm(row.rawCode)}
              disabled={confirming !== null}
            >
              {confirming === row.rawCode ? "…" : "Confirm"}
            </Button>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
