import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { TestEmailButton } from "./test-email-button";

const STATUS_STYLES: Record<string, string> = {
  SENT: "border-green-200 bg-green-50 text-green-700",
  FAILED: "border-red-200 bg-red-50 text-red-700",
  DEV_LOGGED: "border-slate-200 bg-slate-50 text-slate-600",
};

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; status?: string }>;
}) {
  const session = await requirePlatformAdmin();
  const { kind, status } = await searchParams;

  const where: Prisma.EmailLogWhereInput = {};
  if (kind) where.kind = kind;
  if (status) where.status = status;

  const [emails, kinds] = await Promise.all([
    db.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.emailLog.groupBy({ by: ["kind"], _count: true }),
  ]);

  const filterHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { kind, status, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    return `/admin/emails${qs ? `?${qs}` : ""}`;
  };

  const chip = (label: string, href: string, active: boolean) => (
    <Link
      key={label}
      href={href}
      className={
        active
          ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
          : "rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
      }
    >
      {label}
    </Link>
  );

  return (
    <div>
      <PageHeader
        title="Email log"
        description="Every outbound email: complaint alerts, digests, resets, tests."
      />

      <Card className="mb-6 px-5 py-4">
        <p className="mb-2 text-sm font-medium text-slate-700">
          Test email delivery
        </p>
        <TestEmailButton defaultTo={session.email} />
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {chip("All kinds", filterHref({ kind: undefined }), !kind)}
        {kinds.map((k) =>
          chip(
            `${k.kind} (${k._count})`,
            filterHref({ kind: k.kind }),
            kind === k.kind
          )
        )}
        <span className="mx-1 text-slate-300">|</span>
        {chip("Any status", filterHref({ status: undefined }), !status)}
        {chip("Sent", filterHref({ status: "SENT" }), status === "SENT")}
        {chip("Failed", filterHref({ status: "FAILED" }), status === "FAILED")}
        {chip(
          "Dev-logged",
          filterHref({ status: "DEV_LOGGED" }),
          status === "DEV_LOGGED"
        )}
      </div>

      {emails.length === 0 ? (
        <EmptyState
          title="No emails logged yet"
          description="Alerts, digests, and password resets will appear here."
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">When</th>
                <th className="px-5 py-3 font-medium">Kind</th>
                <th className="px-5 py-3 font-medium">To</th>
                <th className="px-5 py-3 font-medium">Subject</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {emails.map((e) => (
                <tr key={e.id} className="align-top hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                    {formatDateTime(e.createdAt)}
                  </td>
                  <td className="px-5 py-3">
                    <Badge>{e.kind}</Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-700">{e.to}</td>
                  <td className="px-5 py-3 text-slate-600">{e.subject}</td>
                  <td className="px-5 py-3">
                    <Badge className={STATUS_STYLES[e.status] ?? ""}>
                      {e.status}
                    </Badge>
                    {e.error ? (
                      <p className="mt-1 max-w-xs text-xs text-red-600">
                        {e.error}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
