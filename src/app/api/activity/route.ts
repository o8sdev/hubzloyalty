import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { badRequest, json, requireApiSession, serverError } from "@/lib/http";
import { activityQuerySchema } from "@/lib/validation";

/**
 * Owner Activity feed: their own business's audit trail, filterable by team
 * member and date range. Scoped to the caller's businessId — never leaks
 * another tenant's actions. Platform-admin rows (actorRole PLATFORM_ADMIN)
 * are excluded so the owner sees only their own team's actions.
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const { businessId } = auth.session;

  const raw: Record<string, string> = {};
  for (const [k, v] of req.nextUrl.searchParams.entries()) if (v) raw[k] = v;
  const parsed = activityQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest("Invalid query", parsed.error.flatten().fieldErrors);
  }
  const { actorUserId, from, to, page, pageSize } = parsed.data;

  const where: Prisma.AuditLogWhereInput = {
    businessId,
    actorRole: { not: "PLATFORM_ADMIN" },
  };
  if (actorUserId) where.actorUserId = actorUserId;
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
        },
      }),
      db.auditLog.count({ where }),
    ]);
    return json({ logs, total, page, pageSize });
  } catch (err) {
    console.error("activity list failed", err);
    return serverError("Could not load activity");
  }
}
