"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

// ---------------------------------------------------------------------------
// The one counter workflow: staff type (or tap from the queue) ANY guest
// code — welcome gift or check-in — see what it is, confirm with one tap.
// Used by the dashboard card and the pocket /counter screen.
// ---------------------------------------------------------------------------

type Lookup = {
  kind: "GIFT" | "CHECKIN" | "REDEMPTION";
  code: string;
  status: "PENDING" | "REDEEMED" | "CONFIRMED" | "EXPIRED" | "CANCELLED";
  rewardText?: string;
  rewardName?: string;
  pointsSpent?: number;
  tableNumber?: string | null;
  expiresAt: string | null;
  redeemedAt?: string | null;
  confirmedAt?: string | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string | null;
    totalVisits?: number;
  } | null;
};

export function CounterConsole({
  big = false,
  prefillCode,
  onConfirmed,
}: {
  /** Pocket layout: larger touch targets for the /counter screen. */
  big?: boolean;
  prefillCode?: string | null;
  onConfirmed?: () => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<
    "idle" | "looking" | "found" | "confirming" | "done"
  >("idle");
  const [result, setResult] = useState<Lookup | null>(null);
  const [confirmedInfo, setConfirmedInfo] = useState<{
    kind: string;
    visitCredited: boolean;
    pointsSpent?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setCode("");
    setResult(null);
    setConfirmedInfo(null);
    setError(null);
    setPhase("idle");
  }, []);

  const lookup = useCallback(async (rawCode: string) => {
    if (!rawCode.trim()) return;
    setError(null);
    setPhase("looking");
    try {
      const res = await fetch(
        `/api/counter/codes/${encodeURIComponent(rawCode.trim())}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No code found");
        setPhase("idle");
        return;
      }
      setResult(data as Lookup);
      setPhase("found");
    } catch {
      setError("Network error — please try again");
      setPhase("idle");
    }
  }, []);

  // Queue rows can hand a code straight to the console.
  useEffect(() => {
    if (prefillCode) {
      setCode(prefillCode);
      void lookup(prefillCode);
    }
  }, [prefillCode, lookup]);

  async function confirm() {
    if (!result) return;
    setError(null);
    setPhase("confirming");
    try {
      const res = await fetch(
        `/api/counter/codes/${encodeURIComponent(result.code)}/confirm`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not confirm this code");
        setPhase("found");
        return;
      }
      setConfirmedInfo({
        kind: data.kind,
        visitCredited: data.visitCredited,
        pointsSpent: data.pointsSpent,
      });
      setPhase("done");
      onConfirmed?.();
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setPhase("found");
    }
  }

  const guestName = result?.customer
    ? [result.customer.firstName, result.customer.lastName]
        .filter(Boolean)
        .join(" ")
    : "a guest";

  const inputSize = big
    ? "py-4 text-2xl tracking-[0.25em] text-center"
    : "text-base tracking-widest";

  return (
    <div>
      {phase === "idle" || phase === "looking" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(code);
          }}
          className={big ? "space-y-3" : "flex gap-2"}
        >
          <Input
            autoFocus={big}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. K7M-2FX"
            maxLength={8}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            className={`font-mono uppercase ${inputSize}`}
            aria-label="Guest code"
          />
          <Button
            type="submit"
            disabled={phase === "looking" || !code.trim()}
            className={big ? "w-full py-3.5 text-lg" : ""}
          >
            {phase === "looking" ? "Checking…" : "Check code"}
          </Button>
        </form>
      ) : null}

      {phase === "found" || phase === "confirming" ? (
        <div className="rounded-xl border border-ink/10 bg-paper p-4">
          {result?.status === "PENDING" ? (
            <>
              <p className="text-sm text-ink-faint">
                <span className="font-mono font-bold text-ink">{result.code}</span>
                {" · "}
                <span className="font-medium text-ink">{guestName}</span>
                {result.kind === "CHECKIN" && result.tableNumber
                  ? ` · table ${result.tableNumber}`
                  : ""}
              </p>
              <p className={`mt-1 font-semibold text-ink ${big ? "text-xl" : "text-base"}`}>
                {result.kind === "GIFT"
                  ? `🎁 ${result.rewardText} — first visit`
                  : result.kind === "REDEMPTION"
                    ? `💳 ${result.rewardName} — ${result.pointsSpent} pts`
                    : `✓ Check-in${
                        typeof result.customer?.totalVisits === "number"
                          ? ` — visit #${result.customer.totalVisits + 1}`
                          : ""
                      }`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  onClick={confirm}
                  disabled={phase === "confirming"}
                  className={big ? "w-full py-3.5 text-lg" : ""}
                >
                  {phase === "confirming"
                    ? "Confirming…"
                    : result.kind === "GIFT"
                      ? "Hand it over — confirm"
                      : result.kind === "REDEMPTION"
                        ? "Redeem — confirm"
                        : "Confirm check-in"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={reset}
                  disabled={phase === "confirming"}
                  className={big ? "w-full" : ""}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-ink">
                {result?.status === "REDEEMED" || result?.status === "CONFIRMED"
                  ? `Already ${result.kind === "CHECKIN" ? "confirmed" : "redeemed"} — ${guestName}.`
                  : "This code has expired."}
              </p>
              <Button variant="secondary" className="mt-3" onClick={reset}>
                Check another code
              </Button>
            </>
          )}
        </div>
      ) : null}

      {phase === "done" ? (
        <div className="rounded-xl border border-moss/30 bg-moss/10 p-4">
          <p className={`font-semibold text-moss ${big ? "text-lg" : "text-sm"}`}>
            ✓{" "}
            {confirmedInfo?.kind === "GIFT"
              ? "Gift handed over"
              : confirmedInfo?.kind === "REDEMPTION"
                ? "Reward redeemed"
                : "Checked in"}{" "}
            — {guestName}
            {confirmedInfo?.kind === "REDEMPTION" && confirmedInfo.pointsSpent
              ? ` · ${confirmedInfo.pointsSpent} pts debited`
              : confirmedInfo?.visitCredited
                ? " · visit + points credited"
                : ""}
          </p>
          <Button variant="secondary" className="mt-3" onClick={reset}>
            Next guest
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
