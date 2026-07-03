"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";

export function WelcomeRewardForm({
  canEdit,
  initial,
}: {
  canEdit: boolean;
  initial: {
    welcomeRewardEnabled: boolean;
    welcomeRewardText: string;
    welcomeRewardExpiryDays: number;
  };
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.welcomeRewardEnabled);
  const [text, setText] = useState(initial.welcomeRewardText);
  const [expiryDays, setExpiryDays] = useState(
    String(initial.welcomeRewardExpiryDays)
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const days = Number(expiryDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      setError("Expiry must be between 1 and 365 days");
      return;
    }
    if (enabled && text.trim().length < 3) {
      setError("Describe the reward (at least 3 characters) before enabling it");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          welcomeRewardEnabled: enabled,
          welcomeRewardText: text.trim(),
          welcomeRewardExpiryDays: days,
        }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save the welcome reward");
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
      <label
        htmlFor="wr-enabled"
        className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50"
      >
        <input
          id="wr-enabled"
          type="checkbox"
          checked={enabled}
          disabled={!canEdit}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-700"
        />
        <span>
          <span className="block text-sm font-medium text-slate-800">
            Give first-time guests a welcome gift
          </span>
          <span className="block text-xs text-slate-500">
            Guests who join your list for the first time get a one-time code to
            show at the counter.
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <div>
          <Label htmlFor="wr-text">The gift</Label>
          <Input
            id="wr-text"
            maxLength={120}
            disabled={!canEdit}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="A free espresso — on us"
          />
        </div>
        <div>
          <Label htmlFor="wr-days">Valid for (days)</Label>
          <Input
            id="wr-days"
            type="number"
            min={1}
            max={365}
            step={1}
            required
            disabled={!canEdit}
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
          />
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Granted for joining your guest list — never for the review itself, and
        identical at every star rating. That keeps you inside Google&apos;s
        review policy and FTC rules.
      </p>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading || !canEdit}>
          {loading ? "Saving…" : "Save welcome reward"}
        </Button>
        {saved ? (
          <span className="text-sm font-medium text-green-700">Saved.</span>
        ) : null}
      </div>
    </form>
  );
}
