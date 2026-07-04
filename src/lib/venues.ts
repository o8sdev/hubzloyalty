import { db } from "@/lib/db";
import { formatRewardCode } from "@/lib/onetime";

// ---------------------------------------------------------------------------
// Public venue reads for the guest app. Only businesses that opted into the
// directory (listed && not suspended) are visible. Ratings come from first-
// party in-app reviews (channel = APP) — the private funnel inbox is excluded.
// No guest identity is required here; per-guest loyalty lands with G1 auth.
// ---------------------------------------------------------------------------

export type VenueCard = {
  slug: string;
  name: string;
  category: string | null;
  city: string | null;
  coverImageUrl: string | null;
  rating: number | null;
  reviewCount: number;
};

export async function listedVenues(): Promise<VenueCard[]> {
  const businesses = await db.business.findMany({
    where: { listed: true, suspendedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      category: true,
      city: true,
      coverImageUrl: true,
    },
  });
  if (businesses.length === 0) return [];

  const agg = await db.review.groupBy({
    by: ["businessId"],
    where: { businessId: { in: businesses.map((b) => b.id) }, channel: "APP" },
    _avg: { rating: true },
    _count: true,
  });
  const byId = new Map(agg.map((a) => [a.businessId, a]));

  return businesses.map((b) => ({
    slug: b.slug,
    name: b.name,
    category: b.category,
    city: b.city,
    coverImageUrl: b.coverImageUrl,
    rating: byId.get(b.id)?._avg.rating ?? null,
    reviewCount: byId.get(b.id)?._count ?? 0,
  }));
}

export async function venueBySlug(slug: string) {
  const b = await db.business.findFirst({
    where: { slug, listed: true, suspendedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      category: true,
      city: true,
      address: true,
      phone: true,
      description: true,
      coverImageUrl: true,
      logoUrl: true,
      photos: {
        orderBy: { position: "asc" },
        select: { id: true, url: true, caption: true },
      },
    },
  });
  if (!b) return null;

  const [agg, reviews] = await Promise.all([
    db.review.aggregate({
      where: { businessId: b.id, channel: "APP" },
      _avg: { rating: true },
      _count: true,
    }),
    db.review.findMany({
      where: { businessId: b.id, channel: "APP", comment: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        guest: { select: { name: true } },
      },
    }),
  ]);

  return {
    ...b,
    rating: agg._avg.rating,
    reviewCount: agg._count,
    reviews,
  };
}

/** A guest's loyalty memberships across every business, plus any live pending
 *  check-in code at each. */
export async function guestMemberships(guestId: string) {
  const now = new Date();
  const customers = await db.customer.findMany({
    where: { guestId },
    orderBy: [{ lastVisitAt: { sort: "desc", nulls: "last" } }],
    select: {
      id: true,
      tier: true,
      loyaltyPoints: true,
      totalVisits: true,
      business: { select: { name: true, slug: true, category: true } },
      checkins: {
        where: { status: "PENDING", expiresAt: { gt: now } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { code: true },
      },
    },
  });
  return customers.map((c) => ({
    id: c.id,
    tier: c.tier,
    points: c.loyaltyPoints,
    visits: c.totalVisits,
    business: c.business,
    pendingCode: c.checkins[0] ? formatRewardCode(c.checkins[0].code) : null,
  }));
}
