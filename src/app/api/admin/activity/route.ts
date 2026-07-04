import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { badRequest, json, requireApiPlatformAdmin, serverError } from "@/lib/http";
import { adminActivityQuerySchema } from "@/lib/validation";

/**
 * Platform-wide audit feed: every business's actions plus platform-admin
 * actions. Filterable by free-text (actor email / summary), business,
 * action key, and date range.
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiPlatformAdmin();
  if (auth.error) return auth.error;

  const raw: Record<string, string> = {};
  for (const [k, v] of req.nextUrl.searchParams.entries()) if (v) raw[k] = v;
  const parsed = adminActivityQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest("Invalid query", parsed.error.flatten().fieldErrors);
  }
  const { q, businessId, action, from, to, page, pageSize } = parsed.data;

  const where: Prisma.AuditLogWhereInput = {};
  if (businessId) where.businessId = businessId;
  if (action) where.action = action;
  if (q) {
    where.OR = [
      { actorEmail: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
    ];
  }
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  try {
    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          action: true,
          summary: true,
          actorEmail: true,
          actorRole: true,
          createdAt: true,
          business: { select: { id: true, name: true } },
        },
      }),
      db.auditLog.count({ where }),
    ]);
    return json({ logs, total, page, pageSize });
  } catch (err) {
    console.error("admin activity list failed", err);
    return serverError("Could not load activity");
  }
}
