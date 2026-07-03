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
import { Counter } from "@/components/marketing/motion";
import { CounterConsole } from "@/components/counter-console";
import { PendingCheckins } from "@/components/pending-checkins";

export default async function DashboardPage() {
  const session = await requireSession();
  const businessId = session.businessId;

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      slug: true,
      googleReviewUrl: true,
      welcomeRewardEnabled: true,
    },
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
    pendingClaims,
    redeemedClaims30d,
    scanBuckets,
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
        customer: {
          select: { firstName: true, lastName: true, phone: true, tags: true },
        },
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
    db.rewardClaim.count({
      where: {
        businessId,
        status: "PENDING",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    }),
    db.rewardClaim.count({
      where: { businessId, status: "REDEEMED", redeemedAt: { gte: since } },
    }),
    // Scan activity, one bucket per day for the last 14 days (one round trip).
    db.$queryRaw<Array<{ day: Date; scans: number }>>`
      SELECT date_trunc('day', "createdAt")::date AS day, count(*)::int AS scans
      FROM "Review"
      WHERE "businessId" = ${businessId}
        AND "createdAt" >= now() - interval '13 days'
      GROUP BY 1
    `,
  ]);

  const avgRating = ratingAgg._avg.rating;
  const firstName = session.name.trim().split(/\s+/)[0] || "there";

  // Fill the 14-day series (zeros included) so quiet days still show.
  const byDay = new Map(
    scanBuckets.map((b) => [new Date(b.day).toISOString().slice(0, 10), b.scans])
  );
  const days: Array<{ key: string; label: string; scans: number; isToday: boolean }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    days.push({
      key,
      label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d),
      scans: byDay.get(key) ?? 0,
      isToday: i === 0,
    });
  }
  const maxScans = Math.max(1, ...days.map((d) => d.scans));
  const scans14d = days.reduce((sum, d) => sum + d.scans, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="f-display text-3xl font-semibold tracking-tight text-ink">
            Good to see you, {firstName}
            <span className="text-brand-700">.</span>
          </h1>
          <p className="mt-1 text-sm text-ink-faint">
            {business?.name ?? "Your business"} · the last 30 days at a glance
          </p>
        </div>
      </div>

      {/* Onboarding nudges — only shown while setup is incomplete. */}
      {!business?.googleReviewUrl ? (
        <Card className="mb-6 border-gold/60 bg-gold/10">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">
                Finish setting up your review funnel
              </p>
              <p className="mt-0.5 text-sm text-ink-soft">
                Add your Google review link so happy guests can post publicly.
              </p>
            </div>
            <LinkButton href="/settings" size="sm">
              Add it in Settings
            </LinkButton>
          </CardBody>
        </Card>
      ) : totalCustomers === 0 ? (
        <Card className="mb-6 border-gold/60 bg-gold/10">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">
                Time to meet your guests
              </p>
              <p className="mt-0.5 text-sm text-ink-soft">
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
        <StatCard
          label="Total guests"
          icon="☺"
          value={<Counter to={totalCustomers} duration={900} />}
        />
        <StatCard
          label="New guests"
          icon="👋"
          value={<Counter to={newCustomers30d} duration={900} />}
          hint="Last 30 days"
        />
        <StatCard
          label="Avg rating"
          icon="★"
          value={
            avgRating === null ? "—" : <Counter to={avgRating} decimals={1} duration={900} />
          }
          hint="Last 30 days"
        />
        <StatCard
          label="Google review clicks"
          icon="↗"
          value={<Counter to={googleClicks30d} duration={900} />}
          hint="Last 30 days"
        />
        <StatCard
          label="Visits"
          icon="🧾"
          value={<Counter to={visits30d} duration={900} />}
          hint="Last 30 days"
        />
        <StatCard
          label="Needs attention"
          icon="⚠"
          value={<Counter to={needsAttentionCount} duration={900} />}
          hint="Low ratings awaiting a response"
        />
      </div>

      {/* Scan activity — last 14 days */}
      <Card className="mt-6">
        <CardHeader
          title="Scan activity"
          description={`${scans14d} scan${scans14d === 1 ? "" : "s"} in the last 14 days`}
        />
        <CardBody>
          <div className="flex h-28 items-end gap-1.5 sm:gap-2">
            {days.map((d, i) => (
              <div
                key={d.key}
                className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                title={`${d.label} · ${d.scans} scan${d.scans === 1 ? "" : "s"}`}
              >
                <span className="text-[10px] font-semibold text-ink-soft opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {d.scans}
                </span>
                <div
                  className={`app-bar w-full rounded-t-md transition-colors duration-200 ${
                    d.isToday
                      ? "bg-gold group-hover:bg-amber-500"
                      : d.scans === 0
                        ? "bg-ink/10"
                        : "bg-brand-600 group-hover:bg-brand-800"
                  }`}
                  style={
                    {
                      height: d.scans === 0 ? "3px" : `${Math.max(8, (d.scans / maxScans) * 100)}%`,
                      "--d": `${i * 45}ms`,
                    } as React.CSSProperties
                  }
                />
                <span className="hidden text-[9px] text-ink-faint sm:block">
                  {i % 2 === 1 ? d.label.split(" ")[1] : ""}
                </span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Counter — confirm a code"
            description={`Check-ins and welcome gifts. ${pendingClaims} gift${pendingClaims === 1 ? "" : "s"} waiting · ${redeemedClaims30d} redeemed in 30 days.`}
            action={
              <LinkButton href="/counter" variant="secondary" size="sm">
                Full screen
              </LinkButton>
            }
          />
          <CardBody>
            <CounterConsole />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Waiting to be confirmed"
            description="Guests in the room right now — points credit on your tap"
          />
          <CardBody>
            <PendingCheckins />
          </CardBody>
        </Card>
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
              <p className="py-6 text-center text-sm text-ink-faint">
                Nothing to handle — nice. ☕
              </p>
            ) : (
              <ul className="divide-y divide-ink/5">
                {attentionReviews.map((review, i) => (
                  <li
                    key={review.id}
                    className="app-row-in group -mx-2 rounded-xl px-2 py-3 transition-colors first:pt-3 last:pb-3 hover:bg-brand-50/60"
                    style={{ "--d": `${i * 60}ms` } as React.CSSProperties}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800"
                        >
                          {(review.customer?.firstName ?? "?").charAt(0).toUpperCase()}
                        </span>
                        <StarRating rating={review.rating} />
                        {review.customer?.tags.includes("callback-requested") ? (
                          <Badge className="border-amber-300 bg-amber-50 text-amber-700">
                            ☎ callback
                          </Badge>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs text-ink-faint">
                        {formatDateTime(review.createdAt)}
                      </span>
                    </div>
                    {review.comment ? (
                      <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">
                        {review.comment}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-sm italic text-ink-faint">
                        No comment left
                      </p>
                    )}
                    {review.customer ? (
                      <p className="mt-1 text-xs font-medium text-ink-faint">
                        {review.customer.firstName}
                        {review.customer.lastName
                          ? ` ${review.customer.lastName}`
                          : ""}
                        {review.customer.phone ? ` · ${review.customer.phone}` : ""}
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
            title="Recent guests"
            description="Newest additions to your list"
            action={
              <LinkButton href="/customers" variant="secondary" size="sm">
                All guests
              </LinkButton>
            }
          />
          <CardBody>
            {recentCustomers.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-faint">
                No guests yet — they&apos;ll show up here.
              </p>
            ) : (
              <ul className="divide-y divide-ink/5">
                {recentCustomers.map((customer, i) => (
                  <li key={customer.id}>
                    <Link
                      href={`/customers/${customer.id}`}
                      className="app-row-in group -mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-brand-50/60"
                      style={{ "--d": `${i * 60}ms` } as React.CSSProperties}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          aria-hidden
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-moss/10 text-xs font-bold text-moss"
                        >
                          {customer.firstName.charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate text-sm font-medium text-ink group-hover:text-brand-700">
                          {customer.firstName}
                          {customer.lastName ? ` ${customer.lastName}` : ""}
                        </span>
                        <TierBadge tier={customer.tier} />
                        {customer.source === "QR" ? (
                          <Badge className="border-brand-200 bg-brand-50 text-brand-800">
                            QR
                          </Badge>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs text-ink-faint">
                        {formatDate(customer.createdAt)}
                      </span>
                    </Link>
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
