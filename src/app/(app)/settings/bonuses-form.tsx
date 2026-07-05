"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";

export function BonusesForm({
  canEdit,
  initial,
}: {
  canEdit: boolean;
  initial: {
    birthdayBonusEnabled: boolean;
    birthdayBonusPoints: number;
    tierBonusEnabled: boolean;
    tierBonusSilverPoints: number;
    tierBonusGoldPoints: number;
    tierBonusVipPoints: number;
    pointsExpiryMonths: number;
  };
}) {
  const router = useRouter();
  const [birthdayEnabled, setBirthdayEnabled] = useState(
    initial.birthdayBonusEnabled
  );
  const [birthdayPoints, setBirthdayPoints] = useState(
    String(initial.birthdayBonusPoints)
  );
  const [tierEnabled, setTierEnabled] = useState(initial.tierBonusEnabled);
  const [tierSilver, setTierSilver] = useState(
    String(initial.tierBonusSilverPoints)
  );
  const [tierGold, setTierGold] = useState(String(initial.tierBonusGoldPoints));
  const [tierVip, setTierVip] = useState(String(initial.tierBonusVipPoints));
  const [expiryMonths, setExpiryMonths] = useState(
    String(initial.pointsExpiryMonths)
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const intIn = (s: string, label: string, max: number): number => {
      const n = Number(s);
      if (!Number.isInteger(n) || n < 0 || n > max) {
        throw new Error(`${label} must be a whole number between 0 and ${max}`);
      }
      return n;
    };

    let payload;
    try {
      payload = {
        birthdayBonusEnabled: birthdayEnabled,
        birthdayBonusPoints: intIn(birthdayPoints, "Birthday points", 100_000),
        tierBonusEnabled: tierEnabled,
        tierBonusSilverPoints: intIn(tierSilver, "Silver bonus", 100_000),
        tierBonusGoldPoints: intIn(tierGold, "Gold bonus", 100_000),
        tierBonusVipPoints: intIn(tierVip, "VIP bonus", 100_000),
        pointsExpiryMonths: intIn(expiryMonths, "Expiry months", 120),
      };
    } catch (err) {
      setError((err as Error).message);
      return;
    }

    if (birthdayEnabled && payload.birthdayBonusPoints < 1) {
      setError("Set the birthday points (at least 1) before enabling it");
      return;
    }
    if (
      tierEnabled &&
      payload.tierBonusSilverPoints +
        payload.tierBonusGoldPoints +
        payload.tierBonusVipPoints <
        1
    ) {
      setError("Set at least one tier's bonus before enabling tier rewards");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save the bonus settings");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Birthday bonus */}
      <div className="space-y-3">
        <label
          htmlFor="bb-enabled"
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50"
        >
          <input
            id="bb-enabled"
            type="checkbox"
            checked={birthdayEnabled}
            disabled={!canEdit}
            onChange={(e) => setBirthdayEnabled(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-ink"
          />
          <span>
            <span className="block text-sm font-medium text-slate-800">
              Birthday bonus
            </span>
            <span className="block text-xs text-slate-500">
              Automatically credit points on a guest&apos;s birthday — once a
              year. Needs a birthday on file.
            </span>
          </span>
        </label>
        <div className="max-w-[200px]">
          <Label htmlFor="bb-points">Points on their birthday</Label>
          <Input
            id="bb-points"
            type="number"
            min={0}
            step={1}
            disabled={!canEdit}
            value={birthdayPoints}
            onChange={(e) => setBirthdayPoints(e.target.value)}
          />
        </div>
      </div>

      {/* Tier-up bonus */}
      <div className="space-y-3 border-t border-slate-100 pt-5">
        <label
          htmlFor="tb-enabled"
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50"
        >
          <input
            id="tb-enabled"
            type="checkbox"
            checked={tierEnabled}
            disabled={!canEdit}
            onChange={(e) => setTierEnabled(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-ink"
          />
          <span>
            <span className="block text-sm font-medium text-slate-800">
              Tier-up bonus
            </span>
            <span className="block text-xs text-slate-500">
              Reward a guest the moment a visit lifts them into a new tier —
              credited once, when they first reach it.
            </span>
          </span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="tb-silver">Silver</Label>
            <Input
              id="tb-silver"
              type="number"
              min={0}
              step={1}
              disabled={!canEdit}
              value={tierSilver}
              onChange={(e) => setTierSilver(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="tb-gold">Gold</Label>
            <Input
              id="tb-gold"
              type="number"
              min={0}
              step={1}
              disabled={!canEdit}
              value={tierGold}
              onChange={(e) => setTierGold(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="tb-vip">VIP</Label>
            <Input
              id="tb-vip"
              type="number"
              min={0}
              step={1}
              disabled={!canEdit}
              value={tierVip}
              onChange={(e) => setTierVip(e.target.value)}
            />
          </div>
        </div>
        <p className="-mt-1 text-xs text-slate-400">
          Points awarded on reaching each tier. Leave a tier at 0 for no bonus.
        </p>
      </div>

      {/* Points expiry */}
      <div className="space-y-3 border-t border-slate-100 pt-5">
        <div className="max-w-[240px]">
          <Label htmlFor="pe-months">Points expire after (months)</Label>
          <Input
            id="pe-months"
            type="number"
            min={0}
            max={120}
            step={1}
            disabled={!canEdit}
            value={expiryMonths}
            onChange={(e) => setExpiryMonths(e.target.value)}
          />
        </div>
        <p className="-mt-1 text-xs text-slate-400">
          A guest&apos;s points expire after this many months with no visit.
          Set <span className="font-medium text-slate-500">0</span> to never
          expire. Expiries are logged to your loyalty ledger.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading || !canEdit}>
          {loading ? "Saving…" : "Save bonuses & expiry"}
        </Button>
        {saved ? (
          <span className="text-sm font-medium text-green-700">Saved.</span>
        ) : null}
      </div>
    </form>
  );
}
