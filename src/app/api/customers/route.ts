import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { badRequest, json, parseBody, requireApiSession, serverError } from "@/lib/http";
import {
  arrayToTags,
  customerCreateSchema,
  customerListQuerySchema,
} from "@/lib/validation";

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
  const { q, tier, tag, sort, page, pageSize } = parsed.data;

  const where: Prisma.CustomerWhereInput = { businessId };
  if (q) {
    // Note: Prisma "contains" is case-sensitive on SQLite (no mode:
    // "insensitive"); acceptable for the MVP.
    where.OR = [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { phone: { contains: q } },
      { email: { contains: q } },
    ];
  }
  if (tier) where.tier = tier;
  if (tag) where.tags = { contains: tag };

  const orderBy: Prisma.CustomerOrderByWithRelationInput =
    sort === "name"
      ? { firstName: "asc" }
      : sort === "visits"
        ? { totalVisits: "desc" }
        : sort === "lastVisit"
          ? { lastVisitAt: "desc" }
          : { createdAt: "desc" };

  try {
    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.customer.count({ where }),
    ]);
    return json({ customers, total, page, pageSize });
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
    return json(customer, { status: 201 });
  } catch (err) {
    console.error("customer create failed", err);
    return serverError("Could not create customer");
  }
}
