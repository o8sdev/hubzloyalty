import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { json, requireApiSession, serverError } from "@/lib/http";

/**
 * Owner feedback inbox — list reviews for the session's business.
 * Query params: filter = all | attention | resolved, page, pageSize.
 * "attention" = low ratings (<= 3) that are still NEW.
 */
export async function GET(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const { businessId } = auth.session;

  const { searchParams } = new URL(req.url);
  const filterParam = searchParams.get("filter");
  const filter =
    filterParam === "attention" || filterParam === "resolved"
      ? filterParam
      : "all";
  const page = Math.max(1, Math.trunc(Number(searchParams.get("page")) || 1));
  const pageSize = Math.min(
    100,
    Math.max(1, Math.trunc(Number(searchParams.get("pageSize")) || 25))
  );

  const where: Prisma.ReviewWhereInput =
    filter === "attention"
      ? { businessId, rating: { lte: 3 }, status: "NEW" }
      : filter === "resolved"
        ? { businessId, status: "RESOLVED" }
        : { businessId };

  try {
    const [
      reviews,
      filteredTotal,
      allTimeTotal,
      ratingAgg,
      googleClicks,
      attentionCount,
    ] = await Promise.all([
      db.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: {
            select: { firstName: true, lastName: true, phone: true },
          },
        },
      }),
      db.review.count({ where }),
      db.review.count({ where: { businessId } }),
      db.review.aggregate({ where: { businessId }, _avg: { rating: true } }),
      db.review.count({ where: { businessId, clickedGoogle: true } }),
      db.review.count({
        where: { businessId, rating: { lte: 3 }, status: "NEW" },
      }),
    ]);

    return json({
      reviews,
      summary: {
        total: allTimeTotal,
        // All-time average, rounded to 1 decimal.
        avgRating: Math.round((ratingAgg._avg.rating ?? 0) * 10) / 10,
        googleClicks,
        attentionCount,
      },
      total: filteredTotal,
      page,
      pageSize,
    });
  } catch (err) {
    console.error("reviews list failed", err);
    return serverError();
  }
}
