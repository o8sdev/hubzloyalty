import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  LinkButton,
  PageHeader,
  StarRating,
  StatCard,
  TierBadge,
} from "@/components/ui";

export default async function DashboardPage() {
  const session = await requireSession();
  const businessId = session.businessId;

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { name: true, slug: true, googleReviewUrl: true },
  });

  // Rolling 30-day window for the headline stats.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalCustomers,
    newCustomers30d,
    ratingAgg,
    googleClicks30d,
    visits30d,
    needsAttentionCount,
    attentionReviews,
    recentCustomers,
  ] = await Promise.all([
    db.customer.count({ where: { businessId } }),
    db.customer.count({ where: { businessId, createdAt: { gte: since } } }),
    db.review.aggregate({
      where: { businessId, createdAt: { gte: since } },
      _avg: { rating: true },
    }),
    db.review.count({
      where: { businessId, createdAt: { gte: since }, clickedGoogle: true },
    }),
    db.visit.count({ where: { businessId, visitedAt: { gte: since } } }),
    db.review.count({
      where: { businessId, status: "NEW", rating: { lte: 3 } },
    }),
    db.review.findMany({
      where: { businessId, status: "NEW", rating: { lte: 3 } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        customer: { select: { firstName: true, lastName: true } },
      },
    }),
    db.customer.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        tier: true,
        source: true,
        createdAt: true,
      },
    }),
  ]);

  const avgRating = ratingAgg._avg.rating;
  const firstName = session.name.trim().split(/\s+/)[0] || "there";

  return (
    <div>
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description={business?.name ?? "Your business"}
      />

      {/* Onboarding nudges — only shown while setup is incomplete. */}
      {!business?.googleReviewUrl ? (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Finish setting up your review funnel
              </p>
              <p className="mt-0.5 text-sm text-amber-800">
                Add your Google review link so happy guests can post publicly.
              </p>
            </div>
            <LinkButton href="/settings" size="sm">
              Add it in Settings
            </LinkButton>
          </CardBody>
        </Card>
      ) : totalCustomers === 0 ? (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Time to meet your guests
              </p>
              <p className="mt-0.5 text-sm text-amber-800">
                Print your QR code and put it where guests pay.
              </p>
            </div>
            <LinkButton href="/settings" size="sm">
              Get your QR code
            </LinkButton>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Total customers" value={totalCustomers} />
        <StatCard
          label="New customers"
          value={newCustomers30d}
          hint="Last 30 days"
        />
        <StatCard
          label="Avg rating"
          value={avgRating === null ? "—" : avgRating.toFixed(1)}
          hint="Last 30 days"
        />
        <StatCard
          label="Google review clicks"
          value={googleClicks30d}
          hint="Last 30 days"
        />
        <StatCard label="Visits" value={visits30d} hint="Last 30 days" />
        <StatCard
          label="Needs attention"
          value={needsAttentionCount}
          hint="Low ratings awaiting a response"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Needs your attention"
            description="Private low ratings from the review funnel"
            action={
              <LinkButton
                href="/reviews?filter=attention"
                variant="secondary"
                size="sm"
              >
                Open inbox
              </LinkButton>
            }
          />
          <CardBody>
            {attentionReviews.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                Nothing to handle — nice.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {attentionReviews.map((review) => (
                  <li key={review.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <StarRating rating={review.rating} />
                      <span className="shrink-0 text-xs text-slate-400">
                        {formatDateTime(review.createdAt)}
                      </span>
                    </div>
                    {review.comment ? (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                        {review.comment}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm italic text-slate-400">
                        No comment left
                      </p>
                    )}
                    {review.customer ? (
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {review.customer.firstName}
                        {review.customer.lastName
                          ? ` ${review.customer.lastName}`
                          : ""}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent customers"
            description="Newest additions to your list"
            action={
              <LinkButton href="/customers" variant="secondary" size="sm">
                All customers
              </LinkButton>
            }
          />
          <CardBody>
            {recentCustomers.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                No customers yet — they&apos;ll show up here.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentCustomers.map((customer) => (
                  <li
                    key={customer.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="truncate text-sm font-medium text-brand-700 hover:underline"
                      >
                        {customer.firstName}
                        {customer.lastName ? ` ${customer.lastName}` : ""}
                      </Link>
                      <TierBadge tier={customer.tier} />
                      <Badge>{customer.source}</Badge>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatDate(customer.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
