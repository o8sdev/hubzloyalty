import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { customerListQuerySchema } from "@/lib/validation";

// ---------------------------------------------------------------------------
// Shared customer-list query building — used by both GET /api/customers and
// the /customers server page (initial render), so the explorer's live results
// and the first paint can never disagree.
// ---------------------------------------------------------------------------

export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;

export function buildCustomerWhere(
  businessId: string,
  query: Pick<
    CustomerListQuery,
    "q" | "tier" | "tag" | "source" | "consent" | "callback"
  >
): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = { businessId };
  if (query.q) {
    where.OR = [
      { firstName: { contains: query.q, mode: "insensitive" } },
      { lastName: { contains: query.q, mode: "insensitive" } },
      { phone: { contains: query.q } },
      { email: { contains: query.q, mode: "insensitive" } },
    ];
  }
  if (query.tier) where.tier = query.tier;
  if (query.tag) where.tags = { contains: query.tag };
  if (query.source) where.source = query.source;
  if (query.consent) where.marketingConsent = query.consent === "yes";
  if (query.callback) where.tags = { contains: "callback-requested" };
  return where;
}

export function customerOrderBy(
  sort: CustomerListQuery["sort"]
): Prisma.CustomerOrderByWithRelationInput {
  return sort === "name"
    ? { firstName: "asc" }
    : sort === "visits"
      ? { totalVisits: "desc" }
      : sort === "lastVisit"
        ? { lastVisitAt: "desc" }
        : { createdAt: "desc" };
}
