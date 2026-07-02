"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Interactive miniature of the real guest funnel (/r/[slug]) for the hero.
// Tap a star → see the exact two-option screen every guest gets. It exists to
// make the "ungated" claim tangible: both doors, every rating.
// ---------------------------------------------------------------------------

const STAR_PATH =
  "M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z";

function Star({ filled, popDelay }: { filled: boolean; popDelay?: number }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-8 w-8 transition-colors duration-300 ${
        filled ? "fill-gold mkt-star-pop" : "fill-ink/15"
      }`}
      style={popDelay !== undefined ? ({ "--d": `${popDelay}ms` } as React.CSSProperties) : undefined}
      aria-hidden
    >
      <path d={STAR_PATH} />
    </svg>
  );
}

export function FunnelDemo() {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);

  const happy = rating >= 4;

  return (
    <div className="relative mx-auto w-[300px] sm:w-[320px]">
      {/* Phone frame */}
      <div className="relative rounded-[2.6rem] border-[10px] border-ink bg-cream shadow-[0_40px_80px_-30px_rgb(33_23_17/0.5)]">
        {/* Notch */}
        <div className="absolute left-1/2 top-2.5 h-5 w-28 -translate-x-1/2 rounded-full bg-ink" />

        <div className="px-5 pb-7 pt-12">
          {/* Café header */}
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-moss text-lg font-bold text-cream f-display">
              B
            </div>
            <p className="f-mono mt-2 text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              Blue Fern Cafe
            </p>
            <p className="f-display mt-1 text-xl font-semibold leading-tight">
              How was your visit today?
            </p>
          </div>

          {rating === 0 ? (
            <>
              {/* Star picker */}
              <div
                className="mt-6 flex justify-center gap-1"
                onMouseLeave={() => setHovered(0)}
              >
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Rate ${i} star${i === 1 ? "" : "s"}`}
                    onMouseEnter={() => setHovered(i)}
                    onClick={() => setRating(i)}
                    className={`rounded-xl p-1 transition-transform duration-200 hover:scale-125 ${
                      i === 5 && hovered === 0 ? "mkt-pulse rounded-full" : ""
                    }`}
                  >
                    <Star filled={i <= hovered} />
                  </button>
                ))}
              </div>
              <p className="f-mono mt-4 text-center text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                ← try it — tap a star
              </p>
            </>
          ) : (
            <>
              <div className="mt-5 flex justify-center gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} filled={i <= rating} popDelay={i * 60} />
                ))}
              </div>

              {/* BOTH options, always — order adapts, options never do. */}
              <div className="mt-5 space-y-2.5">
                {(happy
                  ? (["google", "note"] as const)
                  : (["note", "google"] as const)
                ).map((kind, idx) =>
                  kind === "google" ? (
                    <div
                      key="google"
                      className={`mkt-fade-up rounded-xl px-4 py-3 text-center text-sm font-semibold ${
                        happy
                          ? "bg-ember text-cream shadow-[0_10px_20px_-10px_rgb(212_85_30/0.7)]"
                          : "border-[1.5px] border-ink/20 text-ink"
                      }`}
                      style={{ "--d": `${idx * 120}ms` } as React.CSSProperties}
                    >
                      Share it in a Google review
                    </div>
                  ) : (
                    <div
                      key="note"
                      className={`mkt-fade-up rounded-xl px-4 py-3 text-center text-sm font-semibold ${
                        happy
                          ? "border-[1.5px] border-ink/20 text-ink"
                          : "bg-ink text-cream shadow-[0_10px_20px_-10px_rgb(33_23_17/0.6)]"
                      }`}
                      style={{ "--d": `${idx * 120}ms` } as React.CSSProperties}
                    >
                      Send a private note to the owner
                    </div>
                  )
                )}
              </div>

              <p
                className="mkt-fade-up f-mono mt-4 text-center text-[10px] leading-relaxed uppercase tracking-[0.14em] text-ink-faint"
                style={{ "--d": "300ms" } as React.CSSProperties}
              >
                {happy
                  ? "5★ or 1★ — both doors, every guest"
                  : "complaint intercepted · owner alerted"}
              </p>

              <button
                type="button"
                onClick={() => {
                  setRating(0);
                  setHovered(0);
                }}
                className="mkt-fade-up f-mono mx-auto mt-3 block text-[10px] uppercase tracking-[0.18em] text-ember underline underline-offset-4 hover:text-ember-deep"
                style={{ "--d": "380ms" } as React.CSSProperties}
              >
                ↺ rate again
              </button>
            </>
          )}
        </div>

        {/* Home indicator */}
        <div className="mx-auto mb-2 h-1 w-24 rounded-full bg-ink/20" />
      </div>
    </div>
  );
}
