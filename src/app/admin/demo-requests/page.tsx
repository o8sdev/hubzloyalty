import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";
import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  buttonClasses,
} from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { DEMO_REQUEST_STATUSES } from "@/lib/validation";
import { RequestActions } from "./request-actions";

const PAGE_SIZE = 25;

const STATUS_STYLES: Record<string, string> = {
  NEW: "border-amber-200 bg-amber-50 text-amber-700",
  CONTACTED: "border-blue-200 bg-blue-50 text-blue-700",
  CONVERTED: "border-green-200 bg-green-50 text-green-700",
  DISMISSED: "border-slate-200 bg-slate-50 text-slate-600",
};

const TABS = [
  { label: "New", status: "NEW" },
  { label: "Contacted", status: "CONTACTED" },
  { label: "Converted", status: "CONVERTED" },
  { label: "Dismissed", status: "DISMISSED" },
  { label: "All", status: "all" },
] as const;

export default async function AdminDemoRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requirePlatformAdmin();
  const sp = await searchParams;

  const status = (DEMO_REQUEST_STATUSES as readonly string[]).includes(
    sp.status ?? ""
  )
    ? (sp.status as string)
    : "all";
  const pageRaw = Number(sp.page ?? "1");
  const requestedPage = Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

  const where: Prisma.DemoRequestWhereInput = status === "all" ? {} : { status };

  const [grouped, total] = await Promise.all([
    db.demoRequest.groupBy({ by: ["status"], _count: true }),
    db.demoRequest.count({ where }),
  ]);
  const counts: Record<string, number> = {};
  let allCount = 0;
  for (const g of grouped) {
    counts[g.status] = g._count;
    allCount += g._count;
  }

  // Clamp so out-of-range pages (stale bookmarks) still show data.
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, lastPage);
  const skip = (page - 1) * PAGE_SIZE;

  const requests = await db.demoRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: PAGE_SIZE,
  });

  const from = total === 0 ? 0 : skip + 1;
  const to = skip + requests.length;
  const hasPrev = page > 1;
  const hasNext = to < total;

  const tabHref = (tabStatus: string) =>
    tabStatus === "all"
      ? "/admin/demo-requests"
      : `/admin/demo-requests?status=${tabStatus}`;

  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    params.set("page", String(targetPage));
    return `/admin/demo-requests?${params.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Demo requests"
        description="Inbound leads from the marketing site — work them from new to converted or dismissed."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((tab) => {
          const active = status === tab.status;
          const count = tab.status === "all" ? allCount : counts[tab.status] ?? 0;
          return (
            <Link
              key={tab.status}
              href={tabHref(tab.status)}
              className={
                active
                  ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
                  : "rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              }
            >
              {tab.label} ({count})
            </Link>
          );
        })}
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title={
            status === "all"
              ? "No demo requests yet"
              : `No ${status.toLowerCase()} demo requests`
          }
          description="Leads submitted through the marketing site land here."
        />
      ) : (
        <>
          <div className="space-y-4">
            {requests.map((r) => (
              <Card key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {r.businessName}
                      </span>
                      <Badge className={STATUS_STYLES[r.status] ?? ""}>
                        {r.status}
                      </Badge>
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {r.contactName}
                      {" · "}
                      <a
                        href={`mailto:${r.email}`}
                        className="text-brand-700 hover:underline"
                      >
                        {r.email}
                      </a>
                      {r.phone ? (
                        <>
                          {" · "}
                          <a
                            href={`tel:${r.phone.replace(/[^+\d]/g, "")}`}
                            className="text-brand-700 hover:underline"
                          >
                            {r.phone}
                          </a>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDateTime(r.createdAt)}
                  </span>
                </div>

                {r.message ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                    {r.message}
                  </p>
                ) : null}

                {r.adminNotes ? (
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    <span className="font-medium text-slate-700">Note: </span>
                    {r.adminNotes}
                  </p>
                ) : null}

                {r.status === "CONVERTED" ? (
                  r.convertedBusinessId ? (
                    <div className="mt-3">
                      <LinkButton
                        variant="secondary"
                        size="sm"
                        href={`/admin/businesses/${r.convertedBusinessId}`}
                      >
                        View business →
                      </LinkButton>
                    </div>
                  ) : null
                ) : (
                  <RequestActions
                    id={r.id}
                    status={r.status}
                    adminNotes={r.adminNotes}
                  />
                )}
              </Card>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Showing {from}–{to} of {total}
            </p>
            <div className="flex items-center gap-2">
              {hasPrev ? (
                <Link
                  href={pageHref(page - 1)}
                  className={buttonClasses("secondary", "sm")}
                >
                  Prev
                </Link>
              ) : (
                <span
                  className={buttonClasses(
                    "secondary",
                    "sm",
                    "opacity-50 pointer-events-none"
                  )}
                >
                  Prev
                </span>
              )}
              {hasNext ? (
                <Link
                  href={pageHref(page + 1)}
                  className={buttonClasses("secondary", "sm")}
                >
                  Next
                </Link>
              ) : (
                <span
                  className={buttonClasses(
                    "secondary",
                    "sm",
                    "opacity-50 pointer-events-none"
                  )}
                >
                  Next
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
