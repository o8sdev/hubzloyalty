"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";

export function VisitVerificationForm({
  canEdit,
  initial,
}: {
  canEdit: boolean;
  initial: {
    earnCooldownHours: number;
    maxEarnPerDay: number;
    askTableNumber: boolean;
  };
}) {
  const router = useRouter();
  const [cooldown, setCooldown] = useState(String(initial.earnCooldownHours));
  const [maxPerDay, setMaxPerDay] = useState(String(initial.maxEarnPerDay));
  const [askTable, setAskTable] = useState(initial.askTableNumber);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const cooldownNum = Number(cooldown);
    const maxNum = Number(maxPerDay);
    if (!Number.isInteger(cooldownNum) || cooldownNum < 0 || cooldownNum > 72) {
      setError("Cooldown must be between 0 and 72 hours");
      return;
    }
    if (!Number.isInteger(maxNum) || maxNum < 1 || maxNum > 10) {
      setError("Daily check-ins must be between 1 and 10");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          earnCooldownHours: cooldownNum,
          maxEarnPerDay: maxNum,
          askTableNumber: askTable,
        }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save check-in rules");
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
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="vv-cooldown">Hours between check-ins</Label>
          <Input
            id="vv-cooldown"
            type="number"
            min={0}
            max={72}
            step={1}
            required
            disabled={!canEdit}
            value={cooldown}
            onChange={(e) => setCooldown(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400">
            0 = no cooldown. A guest can&apos;t start a new check-in inside this
            window.
          </p>
        </div>
        <div>
          <Label htmlFor="vv-max">Max check-ins per day</Label>
          <Input
            id="vv-max"
            type="number"
            min={1}
            max={10}
            step={1}
            required
            disabled={!canEdit}
            value={maxPerDay}
            onChange={(e) => setMaxPerDay(e.target.value)}
          />
        </div>
      </div>

      <label
        htmlFor="vv-table"
        className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50"
      >
        <input
          id="vv-table"
          type="checkbox"
          checked={askTable}
          disabled={!canEdit}
          onChange={(e) => setAskTable(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-700"
        />
        <span>
          <span className="block text-sm font-medium text-slate-800">
            Ask guests for their table number
          </span>
          <span className="block text-xs text-slate-500">
            For table service: check-ins show up as &quot;Table 12&quot; in the
            queue so waiters can confirm at the table.
          </span>
        </span>
      </label>

      <p className="text-xs text-slate-400">
        Points only ever credit when you or your staff confirm a guest&apos;s
        code — these rules bound how often a code can even be created. Feedback
        is never limited.
      </p>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading || !canEdit}>
          {loading ? "Saving…" : "Save check-in rules"}
        </Button>
        {saved ? (
          <span className="text-sm font-medium text-green-700">Saved.</span>
        ) : null}
      </div>
    </form>
  );
}
