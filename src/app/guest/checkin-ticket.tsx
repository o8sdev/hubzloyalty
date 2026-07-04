import Link from "next/link";

// Shared presentational result of a guest check-in attempt. `pending` shows the
// bearer code the guest holds up for staff to confirm; the others are friendly
// policy messages (cooldown / daily cap).

export type CheckinResult =
  | { state: "pending"; code: string; businessName: string }
  | { state: "cooldown"; businessName: string }
  | { state: "capped"; businessName: string };

export function CheckinResultCard({ result }: { result: CheckinResult }) {
  if (result.state === "pending") {
    return (
      <div className="rounded-2xl border-2 border-dashed border-ink/20 bg-white p-5 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
          Show this to staff
        </p>
        <p className="mt-2 font-mono text-3xl font-bold tracking-[0.12em] text-ink">
          {result.code}
        </p>
        <p className="mt-2 text-xs text-ink-soft">
          Your visit at <span className="font-medium text-ink">{result.businessName}</span>{" "}
          counts the moment staff confirm it. Valid ~2 hours.
        </p>
        <Link
          href="/guest/wallet"
          className="mt-3 inline-block text-xs font-semibold text-ink hover:underline"
        >
          See it in your wallet →
        </Link>
      </div>
    );
  }

  const message =
    result.state === "cooldown"
      ? `You checked in at ${result.businessName} recently — come back a little later to earn again.`
      : `You've reached today's check-in limit at ${result.businessName}.`;

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4 text-center text-sm text-ink-soft">
      {message}
    </div>
  );
}
