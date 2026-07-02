"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function NotificationsForm({
  canEdit,
  initial,
}: {
  canEdit: boolean;
  initial: { notifyComplaints: boolean; notifyWeeklyDigest: boolean };
}) {
  const router = useRouter();
  const [notifyComplaints, setNotifyComplaints] = useState(
    initial.notifyComplaints
  );
  const [notifyWeeklyDigest, setNotifyWeeklyDigest] = useState(
    initial.notifyWeeklyDigest
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const res = await fetch("/api/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyComplaints, notifyWeeklyDigest }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save notification settings");
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

  const toggle = (
    id: string,
    label: string,
    hint: string,
    checked: boolean,
    onChange: (v: boolean) => void
  ) => (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={!canEdit}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-700"
      />
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {toggle(
        "notify-complaints",
        "Complaint alerts",
        "Email me immediately when a guest leaves a 3-star rating or below.",
        notifyComplaints,
        setNotifyComplaints
      )}
      {toggle(
        "notify-digest",
        "Weekly digest",
        "A Monday-morning summary: scans, average rating, new contacts, Google clicks.",
        notifyWeeklyDigest,
        setNotifyWeeklyDigest
      )}
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading || !canEdit}>
          {loading ? "Saving…" : "Save notifications"}
        </Button>
        {saved ? (
          <span className="text-sm font-medium text-green-700">Saved.</span>
        ) : null}
      </div>
    </form>
  );
}
