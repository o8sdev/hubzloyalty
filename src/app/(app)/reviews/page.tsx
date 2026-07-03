import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  LinkButton,
  PageHeader,
  StarRating,
  StatCard,
} from "@/components/ui";
import { cn, formatDateTime } from "@/lib/utils";
import { ResolveButton } from "./resolve-button";

const PAGE_SIZE = 25;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "attention", label: "Needs attention" },
  { key: "resolved", label: "Resolved" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const session = await requireSession();
  const businessId = session.businessId;

  const sp = await searchParams;
  const filter: FilterKey =
    sp.filter === "attention" || sp.filter === "resolved" ? sp.filter : "all";
  const requestedPage = Math.max(1, Math.trunc(Number(sp.page) || 1));

  const where: Prisma.ReviewWhereInput =
    filter === "attention"
      ? { businessId, rating: { lte: 3 }, status: "NEW" }
      : filter === "resolved"
        ? { businessId, status: "RESOLVED" }
        : { businessId };

  // Count first and clamp the page so out-of-range pages (stale links,
  // resolved items shrinking a filter) still show data, not the empty state.
  const filteredTotal = await db.review.count({ where });
  const page = Math.min(
    requestedPage,
    Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE))
  );

  const [reviews, totalResponses, ratingAgg, googleClicks, attentionCount] =
    await Promise.all([
      db.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          customer: {
            select: { firstName: true, lastName: true, phone: true, tags: true },
          },
        },
      }),
      db.review.count({ where: { businessId } }),
      db.review.aggregate({ where: { businessId }, _avg: { rating: true } }),
      db.review.count({ where: { businessId, clickedGoogle: true } }),
      db.review.count({
        where: { businessId, rating: { lte: 3 }, status: "NEW" },
      }),
    ]);

  const avgRating =
    ratingAgg._avg.rating !== null
      ? (Math.round(ratingAgg._avg.rating * 10) / 10).toFixed(1)
      : "—";
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Reviews & feedback"
        description="Private guest feedback from your QR page. Ratings never block anyone from reviewing you on Google."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Average rating" value={avgRating} hint="All-time" />
        <StatCard label="Total responses" value={totalResponses} />
        <StatCard label="Google review clicks" value={googleClicks} />
        <StatCard
          label="Needs attention"
          value={attentionCount}
          hint="Low ratings awaiting follow-up"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/reviews" : `/reviews?filter=${f.key}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              filter === f.key
                ? "bg-brand-700 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <EmptyState
          title="No feedback yet"
          description="Print your QR code and put it on the counter — every guest response lands here."
          action={
            <LinkButton href="/settings" variant="secondary">
              Get your QR code
            </LinkButton>
          }
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardBody className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StarRating rating={review.rating} />
                    <span className="text-sm font-medium text-slate-700">
                      {review.rating}/5
                    </span>
                    {review.clickedGoogle ? (
                      <Badge className="border-blue-200 bg-blue-50 text-blue-700">
                        Clicked Google
                      </Badge>
                    ) : null}
                    {review.rating <= 3 ? (
                      review.status === "NEW" ? (
                        <Badge className="border-amber-300 bg-amber-50 text-amber-700">
                          NEW
                        </Badge>
                      ) : (
                        <Badge className="border-green-300 bg-green-50 text-green-700">
                          RESOLVED
                        </Badge>
                      )
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      {formatDateTime(review.createdAt)}
                    </span>
                    {review.rating <= 3 && review.status === "NEW" ? (
                      <ResolveButton reviewId={review.id} />
                    ) : null}
                  </div>
                </div>
                {review.comment ? (
                  <p className="text-sm text-slate-700">{review.comment}</p>
                ) : (
                  <p className="text-sm italic text-slate-400">
                    No written feedback
                  </p>
                )}
                {review.customer ? (
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
                    <span>
                      {[review.customer.firstName, review.customer.lastName]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                    {review.customer.phone ? (
                      <>
                        <span aria-hidden>·</span>
                        <a
                          href={`tel:${review.customer.phone.replace(/[^+\d]/g, "")}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {review.customer.phone}
                        </a>
                      </>
                    ) : null}
                    {review.customer.tags.includes("callback-requested") ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                        ☎ callback requested
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          {page > 1 ? (
            <Link
              href={`/reviews?filter=${filter}&page=${page - 1}`}
              className="font-medium text-brand-700 hover:underline"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/reviews?filter=${filter}&page=${page + 1}`}
              className="font-medium text-brand-700 hover:underline"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  );
}
