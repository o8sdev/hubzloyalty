export default function GuestProfilePage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <span aria-hidden className="text-4xl text-ink">
        ☺
      </span>
      <h1 className="mt-3 text-xl font-bold text-ink">Your profile</h1>
      <p className="mt-1 max-w-xs text-sm text-ink-faint">
        Your account, email, marketing preferences, and reviews you&apos;ve left
        for places on HUBz.
      </p>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
        Account · Phase G1
      </p>
    </div>
  );
}
