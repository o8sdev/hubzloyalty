"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, LinkButton, Textarea } from "@/components/ui";

/**
 * Per-card actions for the demo-request inbox. Status transitions:
 * NEW -> CONTACTED (mark contacted), NEW/CONTACTED -> DISMISSED, and
 * NEW/CONTACTED -> "Register business" (conversion happens on the
 * business-create form, which marks this request CONVERTED).
 */
export function RequestActions({
  id,
  status,
  adminNotes,
}: {
  id: string;
  status: string;
  adminNotes: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"status" | "note" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(adminNotes ?? "");

  async function patch(
    body: Record<string, string>,
    kind: "status" | "note"
  ): Promise<boolean> {
    setPending(kind);
    setError(null);
    try {
      const res = await fetch(`/api/admin/demo-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data: { error?: string } = await res.json();
        setError(data.error ?? "Could not update the request");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Network error — please try again");
      return false;
    } finally {
      setPending(null);
    }
  }

  const canContact = status === "NEW";
  const canDismiss = status === "NEW" || status === "CONTACTED";
  const canRegister = status === "NEW" || status === "CONTACTED";

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {canRegister ? (
          <LinkButton size="sm" href={`/admin/businesses/new?fromRequest=${id}`}>
            Register business
          </LinkButton>
        ) : null}
        {canContact ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending !== null}
            onClick={() => patch({ status: "CONTACTED" }, "status")}
          >
            {pending === "status" ? "Working…" : "Mark contacted"}
          </Button>
        ) : null}
        {canDismiss ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending !== null}
            onClick={() => {
              if (window.confirm("Dismiss this demo request?")) {
                void patch({ status: "DISMISSED" }, "status");
              }
            }}
          >
            Dismiss
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setEditingNote((v) => !v);
            setNote(adminNotes ?? "");
            setError(null);
          }}
        >
          {editingNote ? "Close note" : adminNotes ? "Edit note" : "Add note"}
        </Button>
      </div>

      {editingNote ? (
        <div className="max-w-lg space-y-2">
          <Textarea
            rows={3}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Internal note — only platform admins see this"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={note.trim().length === 0 || pending !== null}
              onClick={async () => {
                const ok = await patch({ adminNotes: note.trim() }, "note");
                if (ok) setEditingNote(false);
              }}
            >
              {pending === "note" ? "Saving…" : "Save note"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditingNote(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
