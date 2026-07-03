import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { LinkButton, PageHeader } from "@/components/ui";
import { customerListQuerySchema } from "@/lib/validation";
import { buildCustomerWhere, customerOrderBy } from "@/lib/customers";
import { CustomersExplorer, type ExplorerQuery } from "./customers-explorer";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Server shell for the guests explorer: parses the URL, renders the FIRST
 * page of results server-side (instant paint), then the client explorer
 * takes over — every later search/filter/sort hits /api/customers in place.
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const raw: Record<string, string> = {};
  for (const key of ["q", "tier", "source", "consent", "callback", "sort", "page"] as const) {
    const value = sp[key];
    const str = Array.isArray(value) ? value[0] : value;
    if (str) raw[key] = str;
  }
  const parsed = customerListQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : customerListQuerySchema.parse({});
  const { page, pageSize } = query;

  const where = buildCustomerWhere(session.businessId, query);
  const facetWhere = buildCustomerWhere(session.businessId, {
    ...query,
    tier: undefined,
  });

  const [customers, total, tierGroups] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: customerOrderBy(query.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.customer.count({ where }),
    db.customer.groupBy({ by: ["tier"], where: facetWhere, _count: true }),
  ]);
  const tiers: Record<string, number> = {};
  for (const group of tierGroups) tiers[group.tier] = group._count;

  const initialQuery: ExplorerQuery = {
    q: query.q ?? "",
    tier: query.tier ?? "",
    source: query.source ?? "",
    consent: query.consent ?? "",
    callback: query.callback === "1",
    sort: query.sort,
    page,
  };

  return (
    <div>
      <PageHeader
        title="Guests"
        description="Everyone who has scanned, visited, or left feedback."
        action={
          <div className="flex items-center gap-2">
            <LinkButton
              variant="secondary"
              href="/api/customers/export"
              prefetch={false}
            >
              Export all (CSV)
            </LinkButton>
            <LinkButton href="/customers/new">Add a guest</LinkButton>
          </div>
        }
      />

      <CustomersExplorer
        initialData={{ customers, total, page, pageSize, facets: { tiers } }}
        initialQuery={initialQuery}
      />
    </div>
  );
}
