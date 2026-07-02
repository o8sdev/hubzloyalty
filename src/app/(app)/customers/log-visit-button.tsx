"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Textarea } from "@/components/ui";

export function LogVisitButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const dollars = amount.trim() === "" ? 0 : Number(amount);
    if (Number.isNaN(dollars) || dollars < 0) {
      setError("Enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: Math.round(dollars * 100),
          note: note.trim() || undefined,
        }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not log visit");
        return;
      }
      setOpen(false);
      setAmount("");
      setNote("");
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <Button onClick={() => setOpen((v) => !v)}>Log visit</Button>
      {open ? (
        <div className="absolute right-0 z-10 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <Label htmlFor="visit-amount">Amount spent (optional)</Label>
              <Input
                id="visit-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="visit-note">Note (optional)</Label>
              <Textarea
                id="visit-note"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ordered the usual…"
              />
            </div>
            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "Logging…" : "Log visit"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
