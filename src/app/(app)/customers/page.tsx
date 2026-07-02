import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import {
  Button,
  EmptyState,
  Input,
  Label,
  LinkButton,
  PageHeader,
  Select,
  TierBadge,
  buttonClasses,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { TIERS, customerListQuerySchema } from "@/lib/validation";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  // Same shape the API accepts: single values only, empty strings dropped.
  const raw: Record<string, string> = {};
  for (const key of ["q", "tier", "tag", "sort", "page", "pageSize"] as const) {
    const value = sp[key];
    const str = Array.isArray(value) ? value[0] : value;
    if (str) raw[key] = str;
  }
  const parsedQuery = customerListQuerySchema.safeParse(raw);
  const query = parsedQuery.success
    ? parsedQuery.data
    : customerListQuerySchema.parse({});
  const { q, tier, tag, sort, page, pageSize } = query;

  const where: Prisma.CustomerWhereInput = { businessId: session.businessId };
  if (q) {
    // Note: Prisma "contains" is case-sensitive on SQLite — acceptable for MVP.
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

  // Count first and clamp the page so out-of-range pages (stale bookmarks,
  // deletions) still show data instead of the onboarding empty state.
  const total = await db.customer.count({ where });
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, lastPage);
  const skip = (safePage - 1) * pageSize;
  const customers = await db.customer.findMany({
    where,
    orderBy,
    skip,
    take: pageSize,
  });

  const from = total === 0 ? 0 : skip + 1;
  const to = skip + customers.length;
  const hasPrev = safePage > 1;
  const hasNext = to < total;

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tier) params.set("tier", tier);
    if (tag) params.set("tag", tag);
    if (sort !== "recent") params.set("sort", sort);
    if (pageSize !== 25) params.set("pageSize", String(pageSize));
    params.set("page", String(targetPage));
    return `/customers?${params.toString()}`;
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Everyone who has visited or left feedback."
        action={
          <div className="flex items-center gap-2">
            <LinkButton
              variant="secondary"
              href="/api/customers/export"
              prefetch={false}
            >
              Export CSV
            </LinkButton>
            <LinkButton href="/customers/new">Add customer</LinkButton>
          </div>
        }
      />

      <form
        method="get"
        action="/customers"
        className="mb-4 flex flex-wrap items-end gap-3"
      >
        <div className="w-full max-w-xs">
          <Label htmlFor="q">Search</Label>
          <Input
            id="q"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Name, phone, or email"
          />
        </div>
        <div className="w-40">
          <Label htmlFor="tier">Tier</Label>
          <Select id="tier" name="tier" defaultValue={tier ?? ""}>
            <option value="">All tiers</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {total === 0 ? (
        <EmptyState
          title="No customers yet — they'll appear here when guests scan your QR code"
          description="You can also add customers manually or import them."
          action={<LinkButton href="/customers/new">Add customer</LinkButton>}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Tier</th>
                  <th className="px-4 py-3 font-medium">Visits</th>
                  <th className="px-4 py-3 font-medium">Points</th>
                  <th className="px-4 py-3 font-medium">Last visit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/customers/${c.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {c.firstName}
                        {c.lastName ? ` ${c.lastName}` : ""}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <TierBadge tier={c.tier} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.totalVisits}</td>
                    <td className="px-4 py-3 text-slate-600">{c.loyaltyPoints}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(c.lastVisitAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Showing {from}–{to} of {total}
            </p>
            <div className="flex items-center gap-2">
              {hasPrev ? (
                <Link
                  href={pageHref(safePage - 1)}
                  className={buttonClasses("secondary", "sm")}
                >
                  Prev
                </Link>
              ) : (
                <span className={buttonClasses("secondary", "sm", "opacity-50 pointer-events-none")}>
                  Prev
                </span>
              )}
              {hasNext ? (
                <Link
                  href={pageHref(safePage + 1)}
                  className={buttonClasses("secondary", "sm")}
                >
                  Next
                </Link>
              ) : (
                <span className={buttonClasses("secondary", "sm", "opacity-50 pointer-events-none")}>
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
