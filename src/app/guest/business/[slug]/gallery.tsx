"use client";

import { useEffect, useState } from "react";

// Swipeable photo strip with a tap-to-expand lightbox. Renders the venue's
// real BusinessPhoto images (public bucket URLs).

type Photo = { id: string; url: string };

export function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const count = photos.length;

  useEffect(() => {
    if (open === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((o) => (o === null ? o : (o + 1) % count));
      if (e.key === "ArrowLeft") setOpen((o) => (o === null ? o : (o - 1 + count) % count));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, count]);

  if (count === 0) return null;

  return (
    <>
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Photo ${i + 1} of ${count}`}
            className="h-28 w-40 shrink-0 snap-start overflow-hidden rounded-xl border border-ink/10 bg-paper-deep transition-transform active:scale-[0.98]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>

      {open !== null ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-ink/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(null)}
        >
          <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)_+_0.75rem)] text-white">
            <span className="text-xs font-medium text-white/70">
              {open + 1} / {count}
            </span>
            <button
              type="button"
              onClick={() => setOpen(null)}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg"
            >
              ✕
            </button>
          </div>
          <div
            className="flex flex-1 items-center justify-between gap-2 px-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen((o) => (o === null ? o : (o - 1 + count) % count))}
              aria-label="Previous"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
            >
              ‹
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[open].url}
              alt=""
              className="max-h-full w-full max-w-sm rounded-2xl object-contain"
            />
            <button
              type="button"
              onClick={() => setOpen((o) => (o === null ? o : (o + 1) % count))}
              aria-label="Next"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
            >
              ›
            </button>
          </div>
          <div className="h-[calc(env(safe-area-inset-bottom)_+_1.5rem)]" />
        </div>
      ) : null}
    </>
  );
}
