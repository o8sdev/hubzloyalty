import Link from "next/link";
import { requireGuestSession } from "@/lib/session";
import { TierBadge } from "@/components/ui";
import { guestMemberships } from "@/lib/venues";

export default async function GuestWalletPage() {
  const guest = await requireGuestSession();
  const memberships = await guestMemberships(guest.guestId);

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Wallet</h1>
      <p className="mt-0.5 text-sm text-ink-faint">
        Your points and tier at every place you visit.
      </p>

      {memberships.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-ink/15 bg-white px-6 py-12 text-center">
          <p className="text-3xl" aria-hidden>
            ◈
          </p>
          <h2 className="mt-2 text-base font-semibold text-ink">
            No places yet
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink-faint">
            Open a venue in Discover and tap <span className="font-medium text-ink">Check in here</span> (or scan its QR) to start earning.
          </p>
          <Link
            href="/guest/discover"
            className="mt-4 inline-block rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white"
          >
            Explore places
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {memberships.map((m) => (
            <Link
              key={m.id}
              href={`/guest/business/${m.business.slug}`}
              className="block rounded-2xl border border-ink/10 bg-white p-4 shadow-sm active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">
                    {m.business.name}
                  </p>
                  <p className="truncate text-xs text-ink-faint">
                    {m.business.category ?? "On HUBz"}
                  </p>
                </div>
                <TierBadge tier={m.tier} />
              </div>
              <div className="mt-3 flex items-end justify-between gap-2">
                <div>
                  <p className="text-2xl font-bold leading-none text-ink">
                    {m.points}
                    <span className="ml-1 text-sm font-normal text-ink-faint">
                      pts
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {m.visits} visit{m.visits === 1 ? "" : "s"}
                  </p>
                </div>
                {m.pendingCode ? (
                  <span className="shrink-0 rounded-lg border border-dashed border-ink/25 bg-paper px-2.5 py-1 font-mono text-xs font-bold text-ink">
                    ⏳ {m.pendingCode}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
