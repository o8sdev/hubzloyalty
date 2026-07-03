/**
 * Segment-level loading UI: paints instantly on every admin tab change while
 * the server component streams in, so navigation never feels dead — the
 * shell (sidebar) persists and only the content area skeletons.
 */
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="mb-6">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded bg-slate-200/70" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl border border-slate-200 bg-white"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
