"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Guest deletion: a deliberate, hard-to-fat-finger modal. The red confirm
// button stays disabled until the owner types the guest's name — deletion is a
// permanent GDPR-style erasure of their visits and feedback. Owner-only: the
// server (DELETE /api/customers/[id]) also rejects anyone but the owner, and
// the detail page only renders this for OWNER accounts.
// ---------------------------------------------------------------------------

export function DeleteCustomerButton({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches =
    confirmText.trim().toLowerCase() === customerName.trim().toLowerCase();

  // Focus the confirm field, lock body scroll, and close on Escape.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading]);

  function close() {
    setOpen(false);
    setConfirmText("");
    setError(null);
  }

  async function onDelete() {
    if (!matches) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data: { error?: string } | null = await res
          .json()
          .catch(() => null);
        setError(
          res.status === 403
            ? "Only the business owner can delete a guest."
            : data?.error ?? "Could not delete guest"
        );
        return;
      }
      router.push("/customers");
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
      >
        <span aria-hidden>🗑</span> Delete guest
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-guest-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !loading) close();
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-red-200 bg-cream shadow-2xl">
            <div className="flex items-center gap-3 border-b border-red-100 bg-red-50 px-5 py-4">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-xl text-red-600"
              >
                ⚠
              </span>
              <div>
                <h2
                  id="delete-guest-title"
                  className="text-base font-bold text-red-800"
                >
                  Delete {customerName}?
                </h2>
                <p className="text-xs text-red-600/80">
                  This can&apos;t be undone.
                </p>
              </div>
            </div>

            <div className="space-y-4 px-5 py-5">
              <p className="text-sm text-ink-soft">
                This permanently erases{" "}
                <strong className="text-ink">{customerName}</strong> along with
                all their visits, points, and feedback. To confirm, type their
                name below.
              </p>

              <div>
                <label
                  htmlFor="delete-confirm"
                  className="mb-1 block text-xs font-medium text-ink-faint"
                >
                  Type{" "}
                  <span className="font-semibold text-ink">{customerName}</span>{" "}
                  to confirm
                </label>
                <input
                  id="delete-confirm"
                  ref={inputRef}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && matches && !loading) onDelete();
                  }}
                  autoComplete="off"
                  placeholder={customerName}
                  className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                />
              </div>

              {error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={loading}
                  className="rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-paper disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={!matches || loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? "Deleting…" : "Delete permanently"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
