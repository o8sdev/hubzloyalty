"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { actionMeta, relativeTime, roleChip } from "@/lib/audit-display";

type LogRow = {
  id: string;
  action: string;
  summary: string;
  actorEmail: string;
  actorRole: string;
  createdAt: string;
};

type ListData = { logs: LogRow[]; total: number; page: number; pageSize: number };

export type Member = { id: string; name: string; email: string };

export function ActivityExplorer({
  initialData,
  members,
}: {
  initialData: ListData;
  members: Member[];
}) {
  const [actorUserId, setActorUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListData>(initialData);
  const [loading, setLoading] = useState(false);
  const skipFirst = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!skipFirst.current) {
      skipFirst.current = true;
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    const params = new URLSearchParams();
    if (actorUserId) params.set("actorUserId", actorUserId);
    if (from) params.set("from", from);
    if (to) params.set("to", `${to}T23:59:59`);
    if (page > 1) params.set("page", String(page));
    fetch(`/api/activity?${params.toString()}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: ListData) => setData(d))
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError"))
          console.error("activity fetch failed", e);
      })
      .finally(() => {
        if (abortRef.current === controller) setLoading(false);
      });
    return () => controller.abort();
  }, [actorUserId, from, to, page]);

  const patch = useCallback((fn: () => void) => {
    setPage(1);
    fn();
  }, []);

  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
        <div>
          <label htmlFor="act-member" className="mb-1 block text-xs text-ink-faint">
            Team member
          </label>
          <Select
            id="act-member"
            value={actorUserId}
            onChange={(e) => patch(() => setActorUserId(e.target.value))}
            className="w-52"
          >
            <option value="">Everyone</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="act-from" className="mb-1 block text-xs text-ink-faint">
            From
          </label>
          <input
            id="act-from"
            type="date"
            value={from}
            onChange={(e) => patch(() => setFrom(e.target.value))}
            className="rounded-xl border border-ink/15 bg-paper px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="act-to" className="mb-1 block text-xs text-ink-faint">
            To
          </label>
          <input
            id="act-to"
            type="date"
            value={to}
            onChange={(e) => patch(() => setTo(e.target.value))}
            className="rounded-xl border border-ink/15 bg-paper px-3 py-2 text-sm"
          />
        </div>
        {(actorUserId || from || to) && (
          <button
            type="button"
            onClick={() =>
              patch(() => {
                setActorUserId("");
                setFrom("");
                setTo("");
              })
            }
            className="ml-auto text-xs font-semibold text-ink hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink-faint">
          {data.total === 0 ? "No activity" : `${data.total} action${data.total === 1 ? "" : "s"}`}
        </p>
        <div className={cn("h-1 w-24 overflow-hidden rounded-full transition-opacity", loading ? "opacity-100" : "opacity-0")}>
          <div className="app-shimmer h-full w-full" />
        </div>
      </div>

      {data.logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 bg-white py-16 text-center text-sm text-ink-faint">
          Nothing here yet — your team&apos;s actions will show up as they happen.
        </div>
      ) : (
        <ol className={cn("overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm transition-opacity", loading && "opacity-60")}>
          {data.logs.map((log, i) => {
            const meta = actionMeta(log.action);
            return (
              <li
                key={log.id}
                className="app-row-in flex items-start gap-3 border-b border-ink/5 px-4 py-3 last:border-0"
                style={{ "--d": `${Math.min(i * 20, 240)}ms` } as React.CSSProperties}
              >
                <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper text-sm">
                  {meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{log.summary}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", roleChip(log.actorRole))}>
                      {log.actorRole === "PLATFORM_ADMIN" ? "SUPPORT" : log.actorRole}
                    </span>
                    <span className="truncate">{log.actorEmail}</span>
                    <span aria-hidden>·</span>
                    <span title={new Date(log.createdAt).toLocaleString()}>
                      {relativeTime(log.createdAt)}
                    </span>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {lastPage > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-sm font-medium text-ink-soft hover:border-ink hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            ← Newer
          </button>
          <p className="text-xs text-ink-faint">Page {page} of {lastPage}</p>
          <button
            type="button"
            disabled={page >= lastPage || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-sm font-medium text-ink-soft hover:border-ink hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            Older →
          </button>
        </div>
      )}
    </div>
  );
}
