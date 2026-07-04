"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState, LinkButton, Select, TierBadge } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import { TIERS } from "@/lib/validation";
import { avatarTone, initials } from "@/lib/avatar";

// ---------------------------------------------------------------------------
// Live guest explorer: instant search + chip filters + sort, all in-place.
// Fetches GET /api/customers (debounced, abortable, stale-while-loading) and
// mirrors the active filters into the URL so views are shareable/reloadable.
// Warm café palette: colourful initials, ember/emerald/amber accents.
// ---------------------------------------------------------------------------

type CustomerRow = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  tier: string;
  totalVisits: number;
  loyaltyPoints: number;
  lastVisitAt: string | Date | null;
  marketingConsent: boolean;
  tags: string;
  source: string;
};

type ListData = {
  customers: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
  facets?: { tiers: Record<string, number> };
};

export type ExplorerQuery = {
  q: string;
  tier: string;
  source: string;
  consent: "" | "yes" | "no";
  callback: boolean;
  sort: "recent" | "name" | "visits" | "lastVisit";
  page: number;
};

const SOURCES = [
  { value: "QR", label: "QR scan" },
  { value: "MANUAL", label: "Added by you" },
  { value: "IMPORT", label: "Imported" },
] as const;

const SORTS = [
  { value: "recent", label: "Newest first" },
  { value: "name", label: "Name A–Z" },
  { value: "visits", label: "Most visits" },
  { value: "lastVisit", label: "Last visit" },
] as const;

function toParams(query: ExplorerQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.tier) params.set("tier", query.tier);
  if (query.source) params.set("source", query.source);
  if (query.consent) params.set("consent", query.consent);
  if (query.callback) params.set("callback", "1");
  if (query.sort !== "recent") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  return params;
}

function Chip({
  active,
  onClick,
  children,
  tone = "ink",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "ink" | "moss";
}) {
  // Selection is a state, not an alert → active chips are black. Green ("moss")
  // is reserved for the positive "Consented" filter.
  const activeCls =
    tone === "moss"
      ? "border-moss bg-moss text-white shadow-[0_6px_14px_-8px_rgba(21,128,61,0.9)]"
      : "border-ink bg-ink text-white shadow-[0_6px_14px_-8px_rgba(11,11,12,0.55)]";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200",
        active
          ? activeCls
          : "border-ink/15 bg-white text-ink-soft hover:-translate-y-px hover:border-ink/40 hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

export function CustomersExplorer({
  initialData,
  initialQuery,
}: {
  initialData: ListData;
  initialQuery: ExplorerQuery;
}) {
  const router = useRouter();
  const [query, setQuery] = useState<ExplorerQuery>(initialQuery);
  const [qInput, setQInput] = useState(initialQuery.q);
  const [data, setData] = useState<ListData>(initialData);
  const [loading, setLoading] = useState(false);
  const skippedFirstFetch = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Debounce free-text search into the query object.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setQuery((prev) =>
        prev.q === qInput.trim() ? prev : { ...prev, q: qInput.trim(), page: 1 }
      );
    }, 300);
    return () => window.clearTimeout(handle);
  }, [qInput]);

  // Fetch on every query change (except the initial server-rendered one).
  useEffect(() => {
    if (!skippedFirstFetch.current) {
      skippedFirstFetch.current = true;
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    const params = toParams(query);
    fetch(`/api/customers?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((next: ListData) => setData(next))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("guest list fetch failed", err);
      })
      .finally(() => {
        if (abortRef.current === controller) setLoading(false);
      });

    // Shareable URLs without triggering a server round trip.
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/customers?${qs}` : "/customers");

    return () => controller.abort();
  }, [query]);

  const patch = useCallback((changes: Partial<ExplorerQuery>) => {
    setQuery((prev) => ({ ...prev, page: 1, ...changes }));
  }, []);

  const activeFilterCount =
    (query.q ? 1 : 0) +
    (query.tier ? 1 : 0) +
    (query.source ? 1 : 0) +
    (query.consent ? 1 : 0) +
    (query.callback ? 1 : 0);

  const tierCounts = data.facets?.tiers ?? {};
  const tierTotal = useMemo(
    () => Object.values(tierCounts).reduce((sum, n) => sum + n, 0),
    [tierCounts]
  );

  const from = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const to = (data.page - 1) * data.pageSize + data.customers.length;
  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));

  const clearAll = () => {
    setQInput("");
    setQuery({ q: "", tier: "", source: "", consent: "", callback: false, sort: query.sort, page: 1 });
  };

  return (
    <div>
      {/* ============================== Toolbar */}
      <div className="rounded-2xl border border-ink/10 bg-cream p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <span
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
            >
              ⌕
            </span>
            <input
              type="search"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQInput("");
              }}
              placeholder="Search name, phone, or email…"
              aria-label="Search guests"
              className="w-full rounded-xl border border-ink/15 bg-white py-2 pl-9 pr-9 text-sm text-ink placeholder:text-ink-faint focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10 [&::-webkit-search-cancel-button]:hidden"
            />
            {qInput ? (
              <button
                type="button"
                onClick={() => setQInput("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full px-1 text-ink-faint transition-colors hover:text-ink"
              >
                ✕
              </button>
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="guest-sort" className="text-xs text-ink-faint">
              Sort
            </label>
            <Select
              id="guest-sort"
              value={query.sort}
              onChange={(e) =>
                patch({ sort: e.target.value as ExplorerQuery["sort"] })
              }
              className="w-40"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip active={query.tier === ""} onClick={() => patch({ tier: "" })}>
            All {tierTotal > 0 ? <span className="opacity-70">· {tierTotal}</span> : null}
          </Chip>
          {TIERS.map((tier) => (
            <Chip
              key={tier}
              active={query.tier === tier}
              onClick={() => patch({ tier: query.tier === tier ? "" : tier })}
            >
              {tier.charAt(0) + tier.slice(1).toLowerCase()}
              <span className="ml-1 opacity-70">· {tierCounts[tier] ?? 0}</span>
            </Chip>
          ))}

          <span aria-hidden className="mx-1 h-5 w-px bg-ink/10" />

          <Chip
            active={query.callback}
            onClick={() => patch({ callback: !query.callback })}
          >
            ☎ Callback requested
          </Chip>
          <Chip
            tone="moss"
            active={query.consent === "yes"}
            onClick={() =>
              patch({ consent: query.consent === "yes" ? "" : "yes" })
            }
          >
            ✓ Consented
          </Chip>
          <Chip
            active={query.consent === "no"}
            onClick={() => patch({ consent: query.consent === "no" ? "" : "no" })}
          >
            No consent
          </Chip>

          <span aria-hidden className="mx-1 h-5 w-px bg-ink/10" />

          {SOURCES.map((s) => (
            <Chip
              key={s.value}
              active={query.source === s.value}
              onClick={() =>
                patch({ source: query.source === s.value ? "" : s.value })
              }
            >
              {s.label}
            </Chip>
          ))}

          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="ml-auto text-xs font-semibold text-ink underline-offset-2 hover:underline"
            >
              Clear all ({activeFilterCount})
            </button>
          ) : null}
        </div>
      </div>

      {/* ============================== Result meta + loading rail */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-faint" aria-live="polite">
          {data.total === 0
            ? "No guests"
            : `Showing ${from}–${to} of ${data.total} guest${data.total === 1 ? "" : "s"}`}
        </p>
        <div
          className={cn(
            "h-1 w-24 overflow-hidden rounded-full transition-opacity duration-300",
            loading ? "opacity-100" : "opacity-0"
          )}
          aria-hidden
        >
          <div className="app-shimmer h-full w-full" />
        </div>
      </div>

      {/* ============================== Results */}
      {data.total === 0 && activeFilterCount === 0 ? (
        <div className="mt-2">
          <EmptyState
            title="No guests yet — they'll appear here when guests scan your QR code"
            description="You can also add guests manually or import them."
            action={<LinkButton href="/customers/new">Add a guest</LinkButton>}
          />
        </div>
      ) : data.total === 0 ? (
        <div className="mt-2">
          <EmptyState
            title="No guests match these filters"
            description="Loosen the search or clear the filters to see everyone."
            action={
              <button
                type="button"
                onClick={clearAll}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink/90"
              >
                Clear all filters
              </button>
            }
          />
        </div>
      ) : (
        <div
          className={cn(
            "mt-2 transition-opacity duration-200",
            loading ? "opacity-60" : "opacity-100"
          )}
        >
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-ink/10 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink/10 bg-paper-deep/50 text-[11px] uppercase tracking-wider text-ink-faint">
                <tr>
                  <th className="px-4 py-3 font-semibold">Guest</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Tier</th>
                  <th className="px-4 py-3 font-semibold">Visits</th>
                  <th className="px-4 py-3 font-semibold">Points</th>
                  <th className="px-4 py-3 font-semibold">Last visit</th>
                  <th className="w-8 px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {data.customers.map((c, i) => {
                  const fullName = c.lastName
                    ? `${c.firstName} ${c.lastName}`
                    : c.firstName;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/customers/${c.id}`)}
                      className="app-row-in group cursor-pointer transition-colors hover:bg-paper-deep/50"
                      style={{ "--d": `${Math.min(i * 25, 300)}ms` } as React.CSSProperties}
                    >
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          <span
                            aria-hidden
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm",
                              avatarTone(fullName)
                            )}
                          >
                            {initials(c.firstName, c.lastName)}
                          </span>
                          <span>
                            <Link
                              href={`/customers/${c.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-ink hover:underline"
                            >
                              {fullName}
                            </Link>
                            <span className="mt-0.5 flex items-center gap-1.5">
                              <span
                                aria-hidden
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  c.marketingConsent ? "bg-moss" : "bg-ink/15"
                                )}
                                title={c.marketingConsent ? "Marketing consent" : "No marketing consent"}
                              />
                              <span className="text-[11px] text-ink-faint">
                                {c.marketingConsent ? "consented" : "no consent"}
                                {c.tags.includes("callback-requested") ? (
                                  <span className="font-medium text-brand-700"> · ☎ callback</span>
                                ) : null}
                              </span>
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{c.phone ?? "—"}</td>
                      <td className="px-4 py-3">
                        <TierBadge tier={c.tier} />
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">{c.totalVisits}</td>
                      <td className="px-4 py-3 text-ink-soft">{c.loyaltyPoints}</td>
                      <td className="px-4 py-3 text-ink-soft">{formatDate(c.lastVisitAt)}</td>
                      <td className="px-2 py-3 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink">
                        ›
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {data.customers.map((c, i) => {
              const fullName = c.lastName
                ? `${c.firstName} ${c.lastName}`
                : c.firstName;
              return (
                <Link
                  key={c.id}
                  href={`/customers/${c.id}`}
                  className="app-row-in flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white p-4 shadow-sm active:bg-paper-deep/50"
                  style={{ "--d": `${Math.min(i * 30, 240)}ms` } as React.CSSProperties}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm",
                        avatarTone(fullName)
                      )}
                    >
                      {initials(c.firstName, c.lastName)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {fullName}
                      </p>
                      <p className="truncate text-xs text-ink-faint">
                        {c.totalVisits} visit{c.totalVisits === 1 ? "" : "s"} ·{" "}
                        {c.loyaltyPoints} pts
                        {c.tags.includes("callback-requested") ? " · ☎" : ""}
                      </p>
                    </div>
                  </div>
                  <TierBadge tier={c.tier} />
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {lastPage > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                disabled={data.page <= 1 || loading}
                onClick={() => setQuery((prev) => ({ ...prev, page: prev.page - 1 }))}
                className="rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:pointer-events-none disabled:opacity-40"
              >
                ← Prev
              </button>
              <p className="text-xs text-ink-faint">
                Page {data.page} of {lastPage}
              </p>
              <button
                type="button"
                disabled={data.page >= lastPage || loading}
                onClick={() => setQuery((prev) => ({ ...prev, page: prev.page + 1 }))}
                className="rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:pointer-events-none disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
