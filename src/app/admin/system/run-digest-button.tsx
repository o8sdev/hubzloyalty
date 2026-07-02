"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function RunDigestButton() {
  const router = useRouter();
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (
      !window.confirm(
        "Send the weekly digest to every opted-in business right now?"
      )
    )
      return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/digest", { method: "POST" });
      const data: {
        businesses?: number;
        emailsSent?: number;
        error?: string;
      } = await res.json();
      if (!res.ok) {
        setResult(`Failed: ${data.error ?? "unknown error"}`);
        return;
      }
      setResult(
        `Done — ${data.emailsSent} email(s) across ${data.businesses} business(es).`
      );
      router.refresh();
    } catch {
      setResult("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="secondary" onClick={run} disabled={loading}>
        {loading ? "Running…" : "Run weekly digest now"}
      </Button>
      {result ? <span className="text-sm text-slate-600">{result}</span> : null}
    </div>
  );
}
