import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { json, requireApiPlatformAdmin, serverError } from "@/lib/http";
import { DEMO_REQUEST_STATUSES } from "@/lib/validation";

const PAGE_SIZE = 25;

/**
 * ADMIN endpoint. Paginated demo-request inbox.
 * Query params: status (one of DEMO_REQUEST_STATUSES or "all", default "all"),
 * page (1-based, default 1). newCount always reflects status NEW across the
 * whole table (nav/overview badges), independent of the active filter.
 */
export async function GET(req: Request) {
  const auth = await requireApiPlatformAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") ?? "all";
  const status = (DEMO_REQUEST_STATUSES as readonly string[]).includes(statusParam)
    ? statusParam
    : "all";
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

  const where: Prisma.DemoRequestWhereInput = status === "all" ? {} : { status };

  try {
    const [requests, total, newCount] = await Promise.all([
      db.demoRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      db.demoRequest.count({ where }),
      db.demoRequest.count({ where: { status: "NEW" } }),
    ]);

    return json({ requests, total, page, pageSize: PAGE_SIZE, newCount });
  } catch (err) {
    console.error("admin demo-requests list failed", err);
    return serverError("Could not load demo requests");
  }
}
