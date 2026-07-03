"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

type Lookup = {
  code: string;
  rewardText: string;
  status: "PENDING" | "REDEEMED" | "EXPIRED";
  expiresAt: string | null;
  redeemedAt: string | null;
  customer: { id: string; firstName: string; lastName: string | null } | null;
};

/**
 * Counter workflow: guest reads their code, staff types it, sees what it's
 * worth and who it belongs to, taps once to redeem. Two steps on purpose —
 * nothing is marked redeemed until a human confirms the gift changed hands.
 */
export function RedeemWidget() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"idle" | "looking" | "found" | "redeeming" | "done">("idle");
  const [claim, setClaim] = useState<Lookup | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCode("");
    setClaim(null);
    setError(null);
    setPhase("idle");
  }

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setError(null);
    setPhase("looking");
    try {
      const res = await fetch(`/api/rewards/claims/${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No reward found for that code");
        setPhase("idle");
        return;
      }
      setClaim(data as Lookup);
      setPhase("found");
    } catch {
      setError("Network error — please try again");
      setPhase("idle");
    }
  }

  async function redeem() {
    if (!claim) return;
    setError(null);
    setPhase("redeeming");
    try {
      const res = await fetch(
        `/api/rewards/claims/${encodeURIComponent(claim.code)}/redeem`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not redeem this code");
        setPhase("found");
        return;
      }
      setPhase("done");
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setPhase("found");
    }
  }

  const guestName = claim?.customer
    ? [claim.customer.firstName, claim.customer.lastName].filter(Boolean).join(" ")
    : "a guest";

  return (
    <div>
      {phase === "idle" || phase === "looking" ? (
        <form onSubmit={lookup} className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. K7M-2FX"
            maxLength={8}
            className="font-mono uppercase tracking-widest"
            aria-label="Reward code"
          />
          <Button type="submit" disabled={phase === "looking" || !code.trim()}>
            {phase === "looking" ? "Checking…" : "Check code"}
          </Button>
        </form>
      ) : null}

      {phase === "found" || phase === "redeeming" ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          {claim?.status === "PENDING" ? (
            <>
              <p className="text-sm text-slate-500">
                <span className="font-mono font-bold text-slate-900">{claim.code}</span>
                {" · for "}
                <span className="font-medium text-slate-900">{guestName}</span>
                {claim.expiresAt
                  ? ` · valid until ${new Date(claim.expiresAt).toLocaleDateString()}`
                  : ""}
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                🎁 {claim.rewardText}
              </p>
              <div className="mt-3 flex gap-2">
                <Button onClick={redeem} disabled={phase === "redeeming"}>
                  {phase === "redeeming" ? "Redeeming…" : "Hand it over — mark redeemed"}
                </Button>
                <Button variant="secondary" onClick={reset} disabled={phase === "redeeming"}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-900">
                {claim?.status === "REDEEMED"
                  ? `Already redeemed${claim.redeemedAt ? ` on ${new Date(claim.redeemedAt).toLocaleDateString()}` : ""} — ${claim.rewardText} for ${guestName}.`
                  : `This code expired${claim?.expiresAt ? ` on ${new Date(claim.expiresAt).toLocaleDateString()}` : ""}.`}
              </p>
              <Button variant="secondary" className="mt-3" onClick={reset}>
                Check another code
              </Button>
            </>
          )}
        </div>
      ) : null}

      {phase === "done" ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-semibold text-green-800">
            ✓ Redeemed — {claim?.rewardText} for {guestName}. Enjoy!
          </p>
          <Button variant="secondary" className="mt-3" onClick={reset}>
            Redeem another
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
