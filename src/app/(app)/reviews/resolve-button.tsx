"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function ResolveButton({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve() {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RESOLVED" }),
      });
      if (!res.ok) {
        const data: { error?: string } | null = await res
          .json()
          .catch(() => null);
        setError(data?.error ?? "Could not update review");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button variant="secondary" size="sm" onClick={resolve} disabled={loading}>
        {loading ? "Saving…" : "Mark resolved"}
      </Button>
      {error ? (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
