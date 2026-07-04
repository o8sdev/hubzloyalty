import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { AdminActivityExplorer } from "./activity-explorer";

/**
 * Platform-wide activity: every action across every business plus platform
 * admin actions, filterable by business, actor, action, and date.
 */
export default async function AdminActivityPage() {
  await requirePlatformAdmin();

  const [logs, total, businesses] = await Promise.all([
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
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
    db.auditLog.count(),
    db.business.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Activity"
        description="Every action across every business — owners, staff, and platform admins."
      />
      <AdminActivityExplorer
        initialData={{
          logs: logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
          total,
          page: 1,
          pageSize: 50,
        }}
        businesses={businesses}
      />
    </div>
  );
}
