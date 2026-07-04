export default function GuestScanPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <span aria-hidden className="text-4xl text-ink">
        ▣
      </span>
      <h1 className="mt-3 text-xl font-bold text-ink">Scan to check in</h1>
      <p className="mt-1 max-w-xs text-sm text-ink-faint">
        Point your camera at a HUBz QR at the counter — it logs your visit and
        earns points once staff confirm it.
      </p>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
        Camera scanner · Phase G3
      </p>
    </div>
  );
}
