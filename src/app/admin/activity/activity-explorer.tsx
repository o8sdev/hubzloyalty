"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { actionMeta, relativeTime, roleChip } from "@/lib/audit-display";

type LogRow = {
  id: string;
  action: string;
  summary: string;
  actorEmail: string;
  actorRole: string;
  createdAt: string;
  business: { id: string; name: string } | null;
};

type ListData = { logs: LogRow[]; total: number; page: number; pageSize: number };

const ACTIONS = [
  "auth.login",
  "auth.logout",
  "checkin.confirm",
  "gift.redeem",
  "customer.create",
  "customer.update",
  "customer.delete",
  "visit.create",
  "review.update",
  "settings.business",
  "settings.loyalty",
  "team.invite",
  "team.remove",
  "admin.business.create",
  "admin.business.update",
  "admin.business.delete",
] as const;

export function AdminActivityExplorer({
  initialData,
  businesses,
}: {
  initialData: ListData;
  businesses: { id: string; name: string }[];
}) {
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListData>(initialData);
  const [loading, setLoading] = useState(false);
  const skipFirst = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const h = window.setTimeout(() => {
      setQ((prev) => (prev === qInput.trim() ? prev : qInput.trim()));
      setPage(1);
    }, 300);
    return () => window.clearTimeout(h);
  }, [qInput]);

  useEffect(() => {
    if (!skipFirst.current) {
      skipFirst.current = true;
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (businessId) p.set("businessId", businessId);
    if (action) p.set("action", action);
    if (from) p.set("from", from);
    if (to) p.set("to", `${to}T23:59:59`);
    if (page > 1) p.set("page", String(page));
    fetch(`/api/admin/activity?${p.toString()}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: ListData) => setData(d))
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError"))
          console.error("admin activity fetch failed", e);
      })
      .finally(() => {
        if (abortRef.current === controller) setLoading(false);
      });
    return () => controller.abort();
  }, [q, businessId, action, from, to, page]);

  const patch = useCallback((fn: () => void) => {
    setPage(1);
    fn();
  }, []);

  const anyFilter = q || businessId || action || from || to;
  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div>
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs text-slate-500">Search</label>
            <Input
              type="search"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Actor email or action text…"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Business</label>
            <Select value={businessId} onChange={(e) => patch(() => setBusinessId(e.target.value))} className="w-48">
              <option value="">All businesses</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Action</label>
            <Select value={action} onChange={(e) => patch(() => setAction(e.target.value))} className="w-48">
              <option value="">All actions</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>{actionMeta(a).label} ({a})</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">From</label>
            <input type="date" value={from} onChange={(e) => patch(() => setFrom(e.target.value))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">To</label>
            <input type="date" value={to} onChange={(e) => patch(() => setTo(e.target.value))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          {anyFilter && (
            <button
              type="button"
              onClick={() => patch(() => { setQInput(""); setQ(""); setBusinessId(""); setAction(""); setFrom(""); setTo(""); })}
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {data.total === 0 ? "No activity" : `${data.total.toLocaleString()} action${data.total === 1 ? "" : "s"}`}
        </p>
        <div className={cn("h-1 w-24 overflow-hidden rounded-full transition-opacity", loading ? "opacity-100" : "opacity-0")}>
          <div className="app-shimmer h-full w-full" />
        </div>
      </div>

      {data.logs.length === 0 ? (
        <Card className="py-16 text-center text-sm text-slate-500">No activity matches these filters.</Card>
      ) : (
        <Card className={cn("overflow-hidden transition-opacity", loading && "opacity-60")}>
          <ol>
            {data.logs.map((log) => {
              const meta = actionMeta(log.action);
              return (
                <li key={log.id} className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                  <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm">
                    {meta.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-900">{log.summary}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", roleChip(log.actorRole))}>
                        {log.actorRole === "PLATFORM_ADMIN" ? "SUPPORT" : log.actorRole}
                      </span>
                      <span className="truncate">{log.actorEmail}</span>
                      {log.business ? (<><span aria-hidden>·</span><span className="font-medium text-slate-600">{log.business.name}</span></>) : null}
                      <span aria-hidden>·</span>
                      <span className="font-mono text-[10px]">{log.action}</span>
                      <span aria-hidden>·</span>
                      <span title={new Date(log.createdAt).toLocaleString()}>{relativeTime(log.createdAt)}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {lastPage > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-brand-700 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-40">← Newer</button>
          <p className="text-xs text-slate-400">Page {page} of {lastPage}</p>
          <button type="button" disabled={page >= lastPage || loading} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-brand-700 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-40">Older →</button>
        </div>
      )}
    </div>
  );
}
