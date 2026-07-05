"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Reward = {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
};
type Pending = { code: string; rewardName: string; pointsSpent: number } | null;

// Guest self-redeem: pick an affordable reward → mint a bearer code → show it
// for staff to confirm at the counter (that's when points are actually spent).
// One live code at a time; cancel to pick a different reward.
export function RewardsPanel({
  points,
  rewards,
  initialPending,
}: {
  points: number;
  rewards: Reward[];
  initialPending: Pending;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(initialPending);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mint(reward: Reward) {
    setBusyId(reward.id);
    setError(null);
    try {
      const res = await fetch("/api/guest/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId: reward.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          res.status === 409
            ? "You already have a code waiting — scan or cancel it first."
            : (data.error ?? "Could not create your code")
        );
        if (res.status === 409) router.refresh();
        return;
      }
      setPending({
        code: data.code,
        rewardName: data.rewardName,
        pointsSpent: reward.pointsCost,
      });
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusyId(null);
    }
  }

  async function cancel() {
    if (!pending) return;
    setBusyId("cancel");
    setError(null);
    try {
      const res = await fetch("/api/guest/redeem", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: pending.code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not cancel the code");
        return;
      }
      setPending(null);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusyId(null);
    }
  }

  if (pending) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-ink/20 bg-white p-5 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
          Show this at the counter
        </p>
        <p className="mt-2 font-mono text-3xl font-bold tracking-[0.12em] text-ink">
          {pending.code}
        </p>
        <p className="mt-2 text-sm font-medium text-ink">{pending.rewardName}</p>
        <p className="mt-0.5 text-xs text-ink-soft">
          {pending.pointsSpent} pts — deducted only when staff confirm it.
        </p>
        <button
          type="button"
          onClick={cancel}
          disabled={busyId === "cancel"}
          className="mt-4 text-xs font-semibold text-ink-faint underline disabled:opacity-60"
        >
          {busyId === "cancel" ? "Cancelling…" : "Cancel this code"}
        </button>
        {error ? (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink">Rewards</h2>
        <p className="text-sm text-ink-faint">
          <span className="font-bold text-ink">{points}</span> pts
        </p>
      </div>
      {rewards.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white p-4 text-center text-sm text-ink-faint">
          No rewards to redeem here yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {rewards.map((r) => {
            const affordable = points >= r.pointsCost;
            const short = r.pointsCost - points;
            return (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white p-3.5 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {r.name}
                  </p>
                  <p className="truncate text-xs text-ink-faint">
                    {r.pointsCost} pts
                    {r.description ? ` · ${r.description}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => mint(r)}
                  disabled={!affordable || busyId === r.id}
                  className="shrink-0 rounded-xl bg-ink px-3.5 py-2 text-xs font-semibold text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-ink/25"
                >
                  {busyId === r.id
                    ? "…"
                    : affordable
                      ? "Redeem"
                      : `${short} more`}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error ? (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
