"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

type Reward = {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  costValueCents: number;
  active: boolean;
};

type FormState = {
  name: string;
  description: string;
  pointsCost: string;
  cost: string; // currency units
};

const emptyForm: FormState = { name: "", description: "", pointsCost: "", cost: "" };

export function RewardsCatalog({
  canEdit,
  initial,
}: {
  canEdit: boolean;
  initial: Reward[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toPayload(f: FormState) {
    const pointsCost = Number(f.pointsCost);
    const costValueCents =
      f.cost.trim() === "" ? 0 : Math.round(Number(f.cost) * 100);
    if (!Number.isInteger(pointsCost) || pointsCost < 1) {
      return { error: "Points cost must be a whole number of at least 1" };
    }
    if (!Number.isFinite(costValueCents) || costValueCents < 0) {
      return { error: "Enter a valid cost value (e.g. 0.80)" };
    }
    if (f.name.trim().length < 2) {
      return { error: "Give the reward a name" };
    }
    return {
      payload: {
        name: f.name.trim(),
        description: f.description.trim(),
        pointsCost,
        costValueCents,
      },
    };
  }

  async function send(url: string, method: string, body?: unknown) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Something went wrong");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Network error — please try again");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const p = toPayload(addForm);
    if (p.error) return setError(p.error);
    if (await send("/api/business/rewards", "POST", p.payload)) {
      setAddForm(emptyForm);
      setAdding(false);
    }
  }

  async function onEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const p = toPayload(editForm);
    if (p.error) return setError(p.error);
    if (await send(`/api/business/rewards/${editingId}`, "PATCH", p.payload)) {
      setEditingId(null);
    }
  }

  function startEdit(r: Reward) {
    setEditingId(r.id);
    setError(null);
    setEditForm({
      name: r.name,
      description: r.description ?? "",
      pointsCost: String(r.pointsCost),
      cost: r.costValueCents > 0 ? (r.costValueCents / 100).toFixed(2) : "",
    });
  }

  const fields = (f: FormState, set: (f: FormState) => void, idp: string) => (
    <div className="grid gap-3 sm:grid-cols-[1fr_110px_110px]">
      <div>
        <Label htmlFor={`${idp}-name`}>Reward</Label>
        <Input
          id={`${idp}-name`}
          maxLength={80}
          value={f.name}
          onChange={(e) => set({ ...f, name: e.target.value })}
          placeholder="Free coffee"
        />
      </div>
      <div>
        <Label htmlFor={`${idp}-pts`}>Points</Label>
        <Input
          id={`${idp}-pts`}
          type="number"
          min={1}
          step={1}
          value={f.pointsCost}
          onChange={(e) => set({ ...f, pointsCost: e.target.value })}
          placeholder="100"
        />
      </div>
      <div>
        <Label htmlFor={`${idp}-cost`}>Cost to you</Label>
        <Input
          id={`${idp}-cost`}
          type="number"
          min={0}
          step="0.01"
          value={f.cost}
          onChange={(e) => set({ ...f, cost: e.target.value })}
          placeholder="0.80"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {initial.length === 0 && !adding ? (
        <p className="text-sm text-ink-soft">
          No rewards yet. Add what guests can spend their points on.
        </p>
      ) : null}

      <ul className="divide-y divide-ink/10">
        {initial.map((r) =>
          editingId === r.id ? (
            <li key={r.id} className="py-4">
              <form onSubmit={onEdit} className="space-y-3">
                {fields(editForm, setEditForm, `edit-${r.id}`)}
                <div className="flex items-center gap-2">
                  <Button type="submit" size="sm" disabled={busy}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </li>
          ) : (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-ink">
                  {r.name}
                  {!r.active ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      inactive
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-ink-faint">
                  {r.pointsCost} pts
                  {r.costValueCents > 0
                    ? ` · costs you ${formatMoney(r.costValueCents)}`
                    : ""}
                </p>
              </div>
              {canEdit ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(r)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      send(`/api/business/rewards/${r.id}`, "PATCH", {
                        active: !r.active,
                      })
                    }
                  >
                    {r.active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Delete "${r.name}"? Past redemptions are kept.`)) {
                        send(`/api/business/rewards/${r.id}`, "DELETE");
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              ) : null}
            </li>
          )
        )}
      </ul>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {canEdit ? (
        adding ? (
          <form onSubmit={onAdd} className="space-y-3 rounded-xl border border-ink/10 p-4">
            {fields(addForm, setAddForm, "add")}
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={busy}>
                Add reward
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setAdding(false);
                  setAddForm(emptyForm);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
            + Add reward
          </Button>
        )
      ) : null}
    </div>
  );
}
