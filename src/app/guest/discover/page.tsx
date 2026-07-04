import Link from "next/link";
import { StarRating } from "@/components/ui";
import { cn } from "@/lib/utils";
import { listedVenues } from "@/lib/venues";

const CATEGORIES = ["All", "Coffee", "Restaurant", "Bakery", "Bar"];

export default async function GuestDiscoverPage() {
  const venues = await listedVenues();

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Discover</h1>
      <p className="mt-0.5 text-sm text-ink-faint">
        Cafés and restaurants near you on HUBz.
      </p>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm text-ink-faint">
        <span aria-hidden>⌕</span> Search places
      </div>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map((c, i) => (
          <span
            key={c}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
              i === 0
                ? "border-ink bg-ink text-white"
                : "border-ink/15 bg-white text-ink-soft"
            )}
          >
            {c}
          </span>
        ))}
      </div>

      {venues.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-ink/15 bg-white px-6 py-12 text-center">
          <p className="text-3xl" aria-hidden>
            ☕
          </p>
          <h2 className="mt-2 text-base font-semibold text-ink">
            No places listed yet
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink-faint">
            Businesses show up here once they turn on their HUBz listing and add
            photos from their dashboard.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {venues.map((v) => {
            const initial = v.name.charAt(0).toUpperCase();
            return (
              <Link
                key={v.slug}
                href={`/guest/business/${v.slug}`}
                className="block overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm transition-transform active:scale-[0.99]"
              >
                <div className="relative h-28 bg-gradient-to-br from-zinc-900 via-ink to-zinc-700">
                  {v.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.coverImageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="absolute inset-0 flex items-center justify-center text-6xl font-black leading-none text-white/[0.07]"
                    >
                      {initial}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate font-semibold text-ink">{v.name}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {[v.category, v.city].filter(Boolean).join(" · ") || "On HUBz"}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {v.rating != null ? (
                      <>
                        <StarRating rating={Math.round(v.rating)} />
                        <span className="text-xs text-ink-faint">
                          {v.rating.toFixed(1)} · {v.reviewCount} reviews
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-ink-faint">No reviews yet</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
