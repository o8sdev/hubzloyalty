"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function ReviewForm({
  slug,
  initial,
}: {
  slug: string;
  initial: { rating: number; comment: string } | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setError("Tap a star to rate");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/guest/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, rating, comment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save your review");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-ink/10 bg-white p-4">
      <p className="text-sm font-semibold text-ink">
        {initial ? "Your review" : "Rate this place"}
      </p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i)}
            aria-label={`${i} star${i === 1 ? "" : "s"}`}
            className="p-0.5"
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden
              className={cn("h-7 w-7", i <= rating ? "fill-ink" : "fill-ink/15")}
            >
              <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
            </svg>
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={600}
        rows={3}
        placeholder="Share a little about your visit…"
        className="mt-2 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
      />
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {done ? (
        <p className="mt-2 text-sm font-medium text-moss">
          Thanks — your review is live.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
      >
        {loading ? "Saving…" : initial ? "Update review" : "Post review"}
      </button>
    </form>
  );
}
