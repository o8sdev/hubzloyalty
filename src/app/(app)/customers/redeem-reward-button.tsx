"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

type Reward = { id: string; name: string; pointsCost: number };

/**
 * Staff-side "spend points" control on a guest's profile: pick an active
 * reward the guest can afford → the API deducts the points and logs a
 * Redemption + REDEEM ledger row. Unaffordable rewards are shown disabled.
 */
export function RedeemRewardButton({
  customerId,
  balance,
  rewards,
}: {
  customerId: string;
  balance: number;
  rewards: Reward[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function redeem(rewardId: string) {
    setError(null);
    setBusyId(rewardId);
    try {
      const res = await fetch(`/api/customers/${customerId}/redemptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Could not redeem");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusyId(null);
    }
  }

  if (rewards.length === 0) return null;

  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => setOpen((o) => !o)}>
        Redeem reward
      </Button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-ink/10 bg-cream p-3 shadow-[0_20px_40px_-20px_rgb(11_11_12/0.4)]">
          <p className="mb-2 px-1 text-xs text-ink-faint">
            Balance: <span className="font-semibold text-ink">{balance} pts</span>
          </p>
          <ul className="space-y-1">
            {rewards.map((r) => {
              const affordable = balance >= r.pointsCost;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={!affordable || busyId !== null}
                    onClick={() => redeem(r.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-paper-deep disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="truncate text-ink">{r.name}</span>
                    <span className="shrink-0 text-ink-faint">
                      {busyId === r.id ? "…" : `${r.pointsCost} pts`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {error ? (
            <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
