import Link from "next/link";
import { notFound } from "next/navigation";
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
import {
  AdminBusinessEditForm,
  AdminLoyaltyForm,
  DeleteBusinessButton,
  SuspendBusinessButton,
} from "./business-actions";

export default async function AdminBusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;

  const business = await db.business.findUnique({
    where: { id },
    include: {
      users: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isPlatformAdmin: true,
          createdAt: true,
        },
      },
      _count: { select: { customers: true, visits: true, reviews: true } },
    },
  });
  if (!business) notFound();

  const [reviewAgg, openComplaints, recentReviews] = await Promise.all([
    db.review.aggregate({ where: { businessId: id }, _avg: { rating: true } }),
    db.review.count({ where: { businessId: id, status: "NEW", rating: { lte: 3 } } }),
    db.review.findMany({
      where: { businessId: id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        rating: true,
        comment: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div>
      <PageHeader
        title={business.name}
        description={`Created ${formatDate(business.createdAt)} · ${baseUrl}/r/${business.slug}`}
        action={
          business.suspendedAt ? (
            <Badge className="border-red-200 bg-red-50 text-red-700">
              Suspended since {formatDate(business.suspendedAt)}
            </Badge>
          ) : (
            <Badge className="border-green-200 bg-green-50 text-green-700">
              Active
            </Badge>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Customers" value={business._count.customers} />
        <StatCard label="Visits" value={business._count.visits} />
        <StatCard
          label="Reviews"
          value={business._count.reviews}
          hint={
            reviewAgg._avg.rating
              ? `avg ${reviewAgg._avg.rating.toFixed(1)} ★`
              : undefined
          }
        />
        <StatCard label="Open complaints" value={openComplaints} />
      </div>

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader
            title="Profile"
            description="Slug changes update the public QR URL — reprint required."
          />
          <CardBody>
            <AdminBusinessEditForm
              initial={{
                id: business.id,
                name: business.name,
                slug: business.slug,
                googleReviewUrl: business.googleReviewUrl ?? "",
                timezone: business.timezone,
                notifyComplaints: business.notifyComplaints,
                notifyWeeklyDigest: business.notifyWeeklyDigest,
              }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Loyalty program"
            description="This business's own economics; saving recomputes all customer tiers."
          />
          <CardBody>
            <AdminLoyaltyForm
              businessId={business.id}
              initial={{
                pointsPerVisit: business.pointsPerVisit,
                silverThreshold: business.silverThreshold,
                goldThreshold: business.goldThreshold,
                vipThreshold: business.vipThreshold,
              }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Members"
            action={
              <Link
                href={`/admin/users/new?businessId=${business.id}`}
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                Add member
              </Link>
            }
          />
          <CardBody className="divide-y divide-slate-100 p-0">
            {business.users.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">
                No member accounts (orphaned tenant).
              </p>
            ) : (
              business.users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {u.name}
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        {u.email}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {u.role}
                      {u.isPlatformAdmin ? " · platform admin" : ""} · joined{" "}
                      {formatDate(u.createdAt)}
                    </p>
                  </div>
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="shrink-0 text-sm font-medium text-brand-700 hover:underline"
                  >
                    Manage
                  </Link>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Latest reviews" />
          <CardBody className="divide-y divide-slate-100 p-0">
            {recentReviews.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">No reviews yet.</p>
            ) : (
              recentReviews.map((r) => (
                <div key={r.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <StarRating rating={r.rating} />
                      <Badge
                        className={
                          r.status === "NEW"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-green-200 bg-green-50 text-green-700"
                        }
                      >
                        {r.status}
                      </Badge>
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDateTime(r.createdAt)}
                    </span>
                  </div>
                  {r.comment ? (
                    <p className="mt-1 text-sm text-slate-600">{r.comment}</p>
                  ) : null}
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card className="border-red-200">
          <CardHeader
            title="Danger zone"
            description="Suspension is reversible; deletion is not."
          />
          <CardBody className="flex flex-col gap-4">
            <SuspendBusinessButton
              businessId={business.id}
              suspended={business.suspendedAt !== null}
            />
            <DeleteBusinessButton
              businessId={business.id}
              businessName={business.name}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
