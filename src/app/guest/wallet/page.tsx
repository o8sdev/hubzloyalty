import { requireGuestSession } from "@/lib/session";

export default async function GuestWalletPage() {
  await requireGuestSession();
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <span aria-hidden className="text-4xl text-ink">
        ◈
      </span>
      <h1 className="mt-3 text-xl font-bold text-ink">Your wallet</h1>
      <p className="mt-1 max-w-xs text-sm text-ink-faint">
        Every place you visit, your points and tier — plus rewards waiting to be
        claimed — all in one card stack.
      </p>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
        Loyalty wallet · Phase G3
      </p>
    </div>
  );
}
