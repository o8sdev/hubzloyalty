import { after, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { badRequest, json, parseBody, requireApiSession, serverError } from "@/lib/http";
import {
  arrayToTags,
  customerCreateSchema,
  customerListQuerySchema,
} from "@/lib/validation";
import { buildCustomerWhere, customerOrderBy } from "@/lib/customers";
import { actorFromSession, recordAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const { businessId } = auth.session;

  // Build a plain object from the query string, dropping empty strings so
  // "?tier=" doesn't fail the enum validation.
  const raw: Record<string, string> = {};
  for (const [key, value] of req.nextUrl.searchParams.entries()) {
    if (value !== "") raw[key] = value;
  }
  const parsed = customerListQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest("Invalid query parameters", parsed.error.flatten().fieldErrors);
  }
  const query = parsed.data;
  const { page, pageSize } = query;

  const where = buildCustomerWhere(businessId, query);
  // Tier chip counts: same filters MINUS tier, so the chips stay stable
  // while one of them is active.
  const facetWhere = buildCustomerWhere(businessId, { ...query, tier: undefined });

  try {
    const [customers, total, tierGroups] = await Promise.all([
      db.customer.findMany({
        where,
        orderBy: customerOrderBy(query.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.customer.count({ where }),
      db.customer.groupBy({
        by: ["tier"],
        where: facetWhere,
        _count: true,
      }),
    ]);
    const tiers: Record<string, number> = {};
    for (const group of tierGroups) tiers[group.tier] = group._count;
    return json({ customers, total, page, pageSize, facets: { tiers } });
  } catch (err) {
    console.error("customer list failed", err);
    return serverError("Could not load customers");
  }
}

export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const { businessId } = auth.session;

  const parsed = await parseBody(req, customerCreateSchema);
  if (parsed.error) return parsed.error;
  const { tags, ...data } = parsed.data;

  try {
    const customer = await db.customer.create({
      data: {
        ...data,
        businessId,
        tags: arrayToTags(tags),
        source: "MANUAL",
      },
    });
    after(() =>
      recordAudit({
        businessId,
        actor: actorFromSession(auth.session),
        action: "customer.create",
        summary: `Added guest ${[customer.firstName, customer.lastName].filter(Boolean).join(" ")}`,
        targetType: "customer",
        targetId: customer.id,
      })
    );
    return json(customer, { status: 201 });
  } catch (err) {
    console.error("customer create failed", err);
    return serverError("Could not create customer");
  }
}
