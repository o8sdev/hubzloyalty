"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckinResultCard, type CheckinResult } from "../../checkin-ticket";

export function CheckInButton({
  slug,
  signedIn,
}: {
  slug: string;
  signedIn: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);

  if (!signedIn) {
    return (
      <Link
        href="/guest/login"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.99]"
      >
        Sign in to check in
      </Link>
    );
  }

  if (result) {
    return (
      <div className="mt-3">
        <CheckinResultCard result={result} />
      </div>
    );
  }

  async function checkIn() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/guest/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not check in");
        return;
      }
      setResult(data as CheckinResult);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={checkIn}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
      >
        {loading ? (
          "Checking in…"
        ) : (
          <>
            <span aria-hidden>▣</span> Check in here
          </>
        )}
      </button>
      {error ? (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
