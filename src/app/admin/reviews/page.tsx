import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StarRating,
} from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ business?: string; rating?: string; status?: string }>;
}) {
  await requirePlatformAdmin();
  const { business: businessId, rating, status } = await searchParams;

  const where: Prisma.ReviewWhereInput = {};
  if (businessId) where.businessId = businessId;
  if (rating === "low") where.rating = { lte: 3 };
  if (rating === "high") where.rating = { gte: 4 };
  if (status === "NEW" || status === "RESOLVED") where.status = status;

  const [reviews, businesses] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        rating: true,
        comment: true,
        status: true,
        clickedGoogle: true,
        createdAt: true,
        business: { select: { id: true, name: true } },
        customer: { select: { firstName: true, lastName: true } },
      },
    }),
    db.business.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Build filter links preserving other params.
  const filterHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { business: businessId, rating, status, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    return `/admin/reviews${qs ? `?${qs}` : ""}`;
  };

  const filterChip = (
    label: string,
    href: string,
    active: boolean
  ) => (
    <Link
      key={label + href}
      href={href}
      className={
        active
          ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
          : "rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
      }
    >
      {label}
    </Link>
  );

  return (
    <div>
      <PageHeader
        title="Reviews"
        description="Cross-tenant view of the whole review funnel."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filterChip("All ratings", filterHref({ rating: undefined }), !rating)}
        {filterChip("≤ 3 ★", filterHref({ rating: "low" }), rating === "low")}
        {filterChip("≥ 4 ★", filterHref({ rating: "high" }), rating === "high")}
        <span className="mx-1 text-slate-300">|</span>
        {filterChip("Any status", filterHref({ status: undefined }), !status)}
        {filterChip("New", filterHref({ status: "NEW" }), status === "NEW")}
        {filterChip(
          "Resolved",
          filterHref({ status: "RESOLVED" }),
          status === "RESOLVED"
        )}
      </div>

      <form method="GET" className="mb-4 max-w-xs">
        {rating ? <input type="hidden" name="rating" value={rating} /> : null}
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <select
          name="business"
          defaultValue={businessId ?? ""}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All businesses</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <button type="submit" className="sr-only">
          Filter
        </button>
        <p className="mt-1 text-xs text-slate-400">
          Pick a business and press Enter.
        </p>
      </form>

      {reviews.length === 0 ? (
        <EmptyState title="No reviews match these filters" />
      ) : (
        <Card className="divide-y divide-slate-100">
          {reviews.map((r) => (
            <div key={r.id} className="px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-2">
                  <StarRating rating={r.rating} />
                  <Link
                    href={`/admin/businesses/${r.business.id}`}
                    className="text-sm font-medium text-slate-900 hover:underline"
                  >
                    {r.business.name}
                  </Link>
                  <Badge
                    className={
                      r.status === "NEW"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-green-200 bg-green-50 text-green-700"
                    }
                  >
                    {r.status}
                  </Badge>
                  {r.clickedGoogle ? <Badge>clicked Google</Badge> : null}
                </span>
                <span className="text-xs text-slate-400">
                  {formatDateTime(r.createdAt)}
                </span>
              </div>
              {r.comment ? (
                <p className="mt-1 text-sm text-slate-600">{r.comment}</p>
              ) : null}
              {r.customer ? (
                <p className="mt-1 text-xs text-slate-400">
                  — {r.customer.firstName} {r.customer.lastName ?? ""}
                </p>
              ) : null}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
