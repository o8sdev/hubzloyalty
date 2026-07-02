"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

export function TestEmailButton({ defaultTo }: { defaultTo: string }) {
  const router = useRouter();
  const [to, setTo] = useState(defaultTo);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const data: { ok?: boolean; status?: string; error?: string } =
        await res.json();
      if (!res.ok) {
        setResult(`Failed: ${data.error ?? "unknown error"}`);
        return;
      }
      setResult(
        data.status === "DEV_LOGGED"
          ? "No RESEND_API_KEY configured — the email was logged instead of sent."
          : data.ok
            ? "Sent — check the inbox."
            : "Send failed — see the log below."
      );
      router.refresh();
    } catch {
      setResult("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={send} className="flex flex-wrap items-center gap-2">
      <Input
        type="email"
        required
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="max-w-xs"
        placeholder="you@example.com"
      />
      <Button type="submit" variant="secondary" disabled={loading}>
        {loading ? "Sending…" : "Send test email"}
      </Button>
      {result ? <span className="text-sm text-slate-600">{result}</span> : null}
    </form>
  );
}
