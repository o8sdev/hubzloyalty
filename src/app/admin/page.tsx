import Link from "next/link";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  StarRating,
  StatCard,
} from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";

export default async function AdminOverviewPage() {
  await requirePlatformAdmin();

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // The DB is far away, so round trips dominate: all nine scalar counts ride
  // ONE query via subselects; only the two row-set lists stay separate.
  type OverviewCounts = {
    businesses: bigint;
    suspended: bigint;
    newDemoRequests: bigint;
    users: bigint;
    customers: bigint;
    visits: bigint;
    reviews: bigint;
    reviews7d: bigint;
    avgRating7d: number | null;
    openComplaints: bigint;
    emails7d: bigint;
  };
  const [countRows, recentBusinesses, recentComplaints] = await Promise.all([
    db.$queryRaw<OverviewCounts[]>`
      SELECT
        (SELECT count(*) FROM "Business")                                        AS "businesses",
        (SELECT count(*) FROM "Business" WHERE "suspendedAt" IS NOT NULL)        AS "suspended",
        (SELECT count(*) FROM "DemoRequest" WHERE status = 'NEW')                AS "newDemoRequests",
        (SELECT count(*) FROM "User")                                            AS "users",
        (SELECT count(*) FROM "Customer")                                        AS "customers",
        (SELECT count(*) FROM "Visit")                                           AS "visits",
        (SELECT count(*) FROM "Review")                                          AS "reviews",
        (SELECT count(*) FROM "Review" WHERE "createdAt" >= ${weekAgo})          AS "reviews7d",
        (SELECT avg(rating)::float8 FROM "Review" WHERE "createdAt" >= ${weekAgo}) AS "avgRating7d",
        (SELECT count(*) FROM "Review" WHERE status = 'NEW' AND rating <= 3)     AS "openComplaints",
        (SELECT count(*) FROM "EmailLog" WHERE "createdAt" >= ${weekAgo})        AS "emails7d"
    `,
    db.business.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        suspendedAt: true,
        _count: { select: { customers: true, reviews: true } },
      },
    }),
    db.review.findMany({
      where: { status: "NEW", rating: { lte: 3 } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        business: { select: { id: true, name: true } },
      },
    }),
  ]);
  const counts = countRows[0];
  const businessCount = Number(counts.businesses);
  const suspendedCount = Number(counts.suspended);
  const newDemoRequestCount = Number(counts.newDemoRequests);
  const userCount = Number(counts.users);
  const customerCount = Number(counts.customers);
  const visitCount = Number(counts.visits);
  const reviewCount = Number(counts.reviews);
  const reviewAgg7d = {
    _count: Number(counts.reviews7d),
    _avg: { rating: counts.avgRating7d },
  };
  const openComplaints = Number(counts.openComplaints);
  const emailsSent7d = Number(counts.emails7d);

  return (
    <div>
      <PageHeader
        title="Platform overview"
        description="Everything across every tenant, at a glance."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Businesses"
          value={businessCount}
          hint={suspendedCount > 0 ? `${suspendedCount} suspended` : "all active"}
        />
        <Link href="/admin/demo-requests" className="block">
          <StatCard
            label="New demo requests"
            value={newDemoRequestCount}
            hint="awaiting first contact"
          />
        </Link>
        <StatCard label="Users" value={userCount} />
        <StatCard label="Customers" value={customerCount} hint="across all tenants" />
        <StatCard label="Visits logged" value={visitCount} />
        <StatCard label="Reviews (all time)" value={reviewCount} />
        <StatCard
          label="Reviews (7 days)"
          value={reviewAgg7d._count}
          hint={
            reviewAgg7d._avg.rating
              ? `avg ${reviewAgg7d._avg.rating.toFixed(1)} ★`
              : undefined
          }
        />
        <StatCard
          label="Open complaints"
          value={openComplaints}
          hint="rating ≤ 3, status NEW"
        />
        <StatCard label="Emails (7 days)" value={emailsSent7d} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Newest businesses"
            action={
              <Link
                href="/admin/businesses"
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                View all
              </Link>
            }
          />
          <CardBody className="divide-y divide-slate-100 p-0">
            {recentBusinesses.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">No businesses yet.</p>
            ) : (
              recentBusinesses.map((b) => (
                <Link
                  key={b.id}
                  href={`/admin/businesses/${b.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {b.name}
                      {b.suspendedAt ? (
                        <Badge className="ml-2 border-red-200 bg-red-50 text-red-700">
                          Suspended
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-500">
                      /r/{b.slug} · {b._count.customers} customers ·{" "}
                      {b._count.reviews} reviews
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDate(b.createdAt)}
                  </span>
                </Link>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Latest open complaints"
            action={
              <Link
                href="/admin/reviews?rating=low&status=NEW"
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                View all
              </Link>
            }
          />
          <CardBody className="divide-y divide-slate-100 p-0">
            {recentComplaints.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">
                No open complaints anywhere. 🎉
              </p>
            ) : (
              recentComplaints.map((r) => (
                <div key={r.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <StarRating rating={r.rating} />
                      <Link
                        href={`/admin/businesses/${r.business.id}`}
                        className="text-sm font-medium text-slate-900 hover:underline"
                      >
                        {r.business.name}
                      </Link>
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatDateTime(r.createdAt)}
                    </span>
                  </div>
                  {r.comment ? (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                      {r.comment}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
