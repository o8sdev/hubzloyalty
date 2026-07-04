"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, TierBadge } from "@/components/ui";
import { avatarTone, initials } from "@/lib/avatar";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// The waiter-venue surface: a live queue of check-ins waiting for a human.
// Confirm straight from a card. Each card carries who the guest is (tier +
// visit history) so staff can spot a regular or VIP as they walk up. On the
// dashboard it's a swipeable, size-capped rail; on the counter a wrapping grid
// — neither pushes the page down as the queue grows.
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
    tier: string;
  } | null;
};

// How many cards the dashboard rail shows before "+N more → Counter".
const DASH_LIMIT = 8;

function age(createdAt: string): string {
  const mins = Math.max(
    0,
    Math.round((Date.now() - new Date(createdAt).getTime()) / 60000)
  );
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

function GuestCard({
  row,
  confirming,
  onConfirm,
}: {
  row: PendingRow;
  confirming: string | null;
  onConfirm: (rawCode: string) => void;
}) {
  const c = row.customer;
  const name = c
    ? [c.firstName, c.lastName].filter(Boolean).join(" ") || "Guest"
    : "Guest";
  const isVip = c?.tier === "VIP";
  const visitLabel = !c
    ? "Walk-in"
    : c.totalVisits === 0
      ? "First visit"
      : `${c.totalVisits} visit${c.totalVisits === 1 ? "" : "s"}`;

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col rounded-2xl border bg-white p-3 shadow-sm",
        isVip ? "border-ink/25 ring-1 ring-ink/15" : "border-ink/10"
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
            c ? avatarTone(name) : "bg-ink/25"
          )}
        >
          {c ? initials(c.firstName, c.lastName) : "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{name}</p>
          <p className="truncate text-[11px] text-ink-faint">{visitLabel}</p>
        </div>
        {c ? <TierBadge tier={c.tier} /> : null}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-ink-faint">
        <span className="inline-flex items-center gap-1.5">
          {row.tableNumber ? (
            <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white">
              T{row.tableNumber}
            </span>
          ) : null}
          <span className="font-mono text-ink-soft">{row.code}</span>
        </span>
        <span className="shrink-0">{age(row.createdAt)}</span>
      </div>

      <Button
        size="sm"
        className="mt-2.5 w-full"
        onClick={() => onConfirm(row.rawCode)}
        disabled={confirming !== null}
      >
        {confirming === row.rawCode ? "Confirming…" : "Confirm"}
      </Button>
    </div>
  );
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
      <div className="flex gap-2.5" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn("app-shimmer h-32 rounded-2xl", big ? "flex-1" : "w-[210px] shrink-0")}
          />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink-faint">
        No check-ins waiting. ☕
      </p>
    );
  }

  const errorBanner = error ? (
    <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {error}
    </p>
  ) : null;

  // Counter: a wrapping grid that fills width before it grows down.
  if (big) {
    return (
      <div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <GuestCard
              key={row.rawCode}
              row={row}
              confirming={confirming}
              onConfirm={confirm}
            />
          ))}
        </div>
        {errorBanner}
      </div>
    );
  }

  // Dashboard: a size-capped, swipeable rail.
  const shown = rows.slice(0, DASH_LIMIT);
  const overflow = rows.length - shown.length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium text-ink">
          {rows.length} waiting{rows.length >= 50 ? "+" : ""}
        </span>
        <Link
          href="/counter"
          className="font-medium text-ink-faint transition-colors hover:text-ink"
        >
          Open counter →
        </Link>
      </div>
      <div className="-mx-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
        {shown.map((row) => (
          <div key={row.rawCode} className="w-[210px] shrink-0 snap-start">
            <GuestCard row={row} confirming={confirming} onConfirm={confirm} />
          </div>
        ))}
        {overflow > 0 ? (
          <Link
            href="/counter"
            className="flex w-[130px] shrink-0 snap-start flex-col items-center justify-center rounded-2xl border border-dashed border-ink/20 bg-paper text-center text-sm font-semibold text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
          >
            +{overflow} more
            <span className="mt-0.5 text-[11px] font-normal text-ink-faint">
              View all →
            </span>
          </Link>
        ) : null}
      </div>
      {errorBanner}
    </div>
  );
}
