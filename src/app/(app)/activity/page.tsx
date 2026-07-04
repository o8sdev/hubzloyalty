import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { ActivityExplorer } from "./activity-explorer";

/**
 * Owner Activity page: the full, filterable trail of the business's own team
 * actions (owner + staff). Platform-admin actions are excluded (they live in
 * the admin panel). First page is rendered server-side for an instant paint;
 * the client explorer takes over for filtering.
 */
export default async function ActivityPage() {
  const session = await requireSession();
  const businessId = session.businessId;

  const [logs, total, members] = await Promise.all([
    db.auditLog.findMany({
      where: { businessId, actorRole: { not: "PLATFORM_ADMIN" } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        action: true,
        summary: true,
        actorEmail: true,
        actorRole: true,
        createdAt: true,
      },
    }),
    db.auditLog.count({
      where: { businessId, actorRole: { not: "PLATFORM_ADMIN" } },
    }),
    db.user.findMany({
      where: { businessId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, email: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Activity"
        description="Everything you and your team have done — who, what, and when."
      />
      <ActivityExplorer
        initialData={{
          logs: logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
          total,
          page: 1,
          pageSize: 30,
        }}
        members={members}
      />
    </div>
  );
}
