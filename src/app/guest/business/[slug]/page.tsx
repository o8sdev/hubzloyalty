import { notFound } from "next/navigation";
import Link from "next/link";
import { StarRating } from "@/components/ui";
import { avatarTone } from "@/lib/avatar";
import { cn, formatDate } from "@/lib/utils";
import { venueBySlug, guestVenueContext, guestRewardsContext } from "@/lib/venues";
import { getGuestSession } from "@/lib/session";
import { PhotoGallery } from "./gallery";
import { CheckInButton } from "./check-in-button";
import { RewardsPanel } from "./rewards-panel";
import { ReviewForm } from "./review-form";

export default async function GuestVenuePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const v = await venueBySlug(slug);
  if (!v) notFound();
  const guest = await getGuestSession();
  const [ctx, rewards] = guest
    ? await Promise.all([
        guestVenueContext(v.id, guest.guestId),
        guestRewardsContext(v.id, guest.guestId),
      ])
    : [null, null];

  const initial = v.name.charAt(0).toUpperCase();
  const meta = [v.category, v.city].filter(Boolean).join(" · ");

  return (
    <div className="pb-20">
      {/* Hero cover (full-bleed within the phone frame) */}
      <div className="relative -mx-4 h-52 overflow-hidden bg-gradient-to-br from-zinc-900 via-ink to-zinc-700">
        {v.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center text-[9rem] font-black leading-none text-white/[0.06]"
          >
            {initial}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-ink/60 to-transparent" />
        <Link
          href="/guest/discover"
          aria-label="Back to discover"
          className="absolute left-4 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur"
        >
          ‹
        </Link>
      </div>

      {/* Identity */}
      <div className="-mt-9 flex items-end gap-3">
        <span
          aria-hidden
          className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-paper bg-ink text-2xl font-bold text-white shadow-md"
        >
          {v.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </span>
      </div>

      <h1 className="mt-3 text-2xl font-bold text-ink">{v.name}</h1>
      {meta ? <p className="mt-0.5 text-sm text-ink-faint">{meta}</p> : null}
      <div className="mt-2 flex items-center gap-2">
        {v.rating != null ? (
          <>
            <StarRating rating={Math.round(v.rating)} />
            <span className="text-sm font-medium text-ink">{v.rating.toFixed(1)}</span>
            <span className="text-sm text-ink-faint">({v.reviewCount})</span>
          </>
        ) : (
          <span className="text-sm text-ink-faint">No reviews yet</span>
        )}
      </div>

      {/* Check in — tap here at the counter, or scan the QR from the Scan tab */}
      <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-ink">Check in when you visit</p>
        <p className="mt-0.5 text-xs text-ink-faint">
          Tap below at the counter (or scan the QR) to log your visit — it earns
          points once staff confirm it.
        </p>
        <CheckInButton slug={v.slug} signedIn={!!guest} />
      </div>

      {/* Rewards — redeem points for a code staff confirm at the counter */}
      {rewards && (rewards.rewards.length > 0 || rewards.pending) ? (
        <section className="mt-4">
          <RewardsPanel
            points={rewards.points}
            rewards={rewards.rewards}
            initialPending={rewards.pending}
          />
        </section>
      ) : null}

      {/* Photos */}
      {v.photos.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-ink">Photos</h2>
          <PhotoGallery photos={v.photos} />
        </section>
      ) : null}

      {/* About */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-ink">About</h2>
        {v.description ? (
          <p className="text-sm leading-relaxed text-ink-soft">{v.description}</p>
        ) : (
          <p className="text-sm text-ink-faint">
            This place hasn&apos;t added a description yet.
          </p>
        )}
        <dl className="mt-3 space-y-2 text-sm">
          {v.address ? (
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-ink-faint">Address</dt>
              <dd className="text-ink">{v.address}</dd>
            </div>
          ) : null}
          {v.phone ? (
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-ink-faint">Phone</dt>
              <dd className="text-ink">{v.phone}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {/* Reviews */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-ink">
          Reviews{" "}
          <span className="font-normal text-ink-faint">({v.reviewCount})</span>
        </h2>

        {ctx?.canReview ? (
          <div className="mb-3">
            <ReviewForm
              slug={v.slug}
              initial={
                ctx.review
                  ? { rating: ctx.review.rating, comment: ctx.review.comment ?? "" }
                  : null
              }
            />
          </div>
        ) : ctx?.hasCheckedIn ? (
          <p className="mb-3 rounded-xl border border-dashed border-ink/15 bg-white p-3 text-center text-xs text-ink-faint">
            Once staff confirm your check-in, you&apos;ll be able to leave a review.
          </p>
        ) : guest ? (
          <p className="mb-3 rounded-xl border border-dashed border-ink/15 bg-white p-3 text-center text-xs text-ink-faint">
            Check in here to leave a review.
          </p>
        ) : null}

        {v.reviews.length === 0 ? (
          <p className="rounded-2xl border border-ink/10 bg-white p-4 text-center text-sm text-ink-faint">
            No reviews yet — be the first after your visit.
          </p>
        ) : (
          <ul className="space-y-3">
            {v.reviews.map((r) => {
              const author = r.guest?.name ?? "Guest";
              return (
                <li key={r.id} className="rounded-2xl border border-ink/10 bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white",
                        avatarTone(author)
                      )}
                    >
                      {author.charAt(0).toUpperCase()}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-ink">{author}</p>
                      <p className="text-[11px] text-ink-faint">
                        {formatDate(r.createdAt)}
                      </p>
                    </div>
                    <StarRating rating={r.rating} />
                  </div>
                  {r.comment ? (
                    <p className="mt-2 text-sm text-ink-soft">{r.comment}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
