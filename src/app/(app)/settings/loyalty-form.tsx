"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";

type LoyaltyInitial = {
  pointsPerVisit: number;
  silverThreshold: number;
  goldThreshold: number;
  vipThreshold: number;
};

export function LoyaltyForm({
  canEdit,
  initial,
}: {
  canEdit: boolean;
  initial: LoyaltyInitial;
}) {
  const router = useRouter();
  const [pointsPerVisit, setPointsPerVisit] = useState(
    String(initial.pointsPerVisit)
  );
  const [silverThreshold, setSilverThreshold] = useState(
    String(initial.silverThreshold)
  );
  const [goldThreshold, setGoldThreshold] = useState(
    String(initial.goldThreshold)
  );
  const [vipThreshold, setVipThreshold] = useState(
    String(initial.vipThreshold)
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const payload = {
      pointsPerVisit: Number(pointsPerVisit),
      silverThreshold: Number(silverThreshold),
      goldThreshold: Number(goldThreshold),
      vipThreshold: Number(vipThreshold),
    };
    if (Object.values(payload).some((n) => !Number.isFinite(n) || n < 0)) {
      setError("All values must be positive numbers");
      return;
    }
    if (
      !(
        payload.silverThreshold < payload.goldThreshold &&
        payload.goldThreshold < payload.vipThreshold
      )
    ) {
      setError("Thresholds must increase: Silver < Gold < VIP");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/business/loyalty", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save loyalty settings");
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

  const numberInput = (
    id: string,
    label: string,
    value: string,
    setValue: (v: string) => void,
    hint?: string
  ) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        step={1}
        required
        disabled={!canEdit}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {numberInput(
          "pointsPerVisit",
          "Points per visit",
          pointsPerVisit,
          setPointsPerVisit,
          "Earned on every visit or QR check-in"
        )}
        {numberInput(
          "silverThreshold",
          "Silver at (visits)",
          silverThreshold,
          setSilverThreshold
        )}
        {numberInput(
          "goldThreshold",
          "Gold at (visits)",
          goldThreshold,
          setGoldThreshold
        )}
        {numberInput(
          "vipThreshold",
          "VIP at (visits)",
          vipThreshold,
          setVipThreshold
        )}
      </div>
      <p className="text-xs text-slate-500">
        Customers below the Silver threshold are Bronze. Saving recalculates
        the tier of every existing customer.
      </p>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading || !canEdit}>
          {loading ? "Saving…" : "Save loyalty settings"}
        </Button>
        {saved ? (
          <span className="text-sm font-medium text-green-700">Saved</span>
        ) : null}
        {!canEdit ? (
          <span className="text-xs text-slate-400">
            Only owners and admins can change loyalty settings.
          </span>
        ) : null}
      </div>
    </form>
  );
}
