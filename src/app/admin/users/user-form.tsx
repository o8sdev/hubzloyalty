"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Select } from "@/components/ui";

// ---------------------------------------------------------------------------
// Shared create/edit form for platform-admin user management. In edit mode
// the password field is optional ("set a new password"); email is immutable
// after creation (it's the login identifier).
// ---------------------------------------------------------------------------

export type BusinessOption = { id: string; name: string };

export function AdminUserForm({
  mode,
  businesses,
  selfId,
  initial,
}: {
  mode: "create" | "edit";
  businesses: BusinessOption[];
  /** The signed-in admin's user id (self-demotion is blocked server-side too). */
  selfId: string;
  initial?: {
    id: string;
    name: string;
    email: string;
    role: string;
    businessId: string | null;
    isPlatformAdmin: boolean;
  };
  /** Pre-select a business when arriving from a business detail page. */
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(initial?.role ?? "STAFF");
  const [businessId, setBusinessId] = useState(initial?.businessId ?? "");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(
    initial?.isPlatformAdmin ?? false
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const isSelf = mode === "edit" && initial?.id === selfId;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const url =
        mode === "create" ? "/api/admin/users" : `/api/admin/users/${initial!.id}`;
      const body =
        mode === "create"
          ? {
              name,
              email,
              password,
              role,
              businessId: businessId || null,
              isPlatformAdmin,
            }
          : {
              name,
              role,
              businessId: businessId || null,
              isPlatformAdmin,
              ...(password ? { password } : {}),
            };
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save user");
        return;
      }
      if (mode === "create") {
        router.push("/admin/users");
      } else {
        setSaved(true);
        setPassword("");
      }
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="uf-name">Name</Label>
          <Input
            id="uf-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="uf-email">Email</Label>
          <Input
            id="uf-email"
            type="email"
            required
            disabled={mode === "edit"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {mode === "edit" ? (
            <p className="mt-1 text-xs text-slate-400">
              Emails are login identifiers and cannot be changed here.
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="uf-password">
            {mode === "create" ? "Password" : "Set new password (optional)"}
          </Label>
          <Input
            id="uf-password"
            type="text"
            required={mode === "create"}
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <Label htmlFor="uf-role">Business role</Label>
          <Select
            id="uf-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="OWNER">OWNER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="STAFF">STAFF</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="uf-business">Business</Label>
          <Select
            id="uf-business"
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
          >
            <option value="">— none (platform-only account) —</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={isPlatformAdmin}
          disabled={isSelf}
          onChange={(e) => setIsPlatformAdmin(e.target.checked)}
          className="h-4 w-4 accent-brand-700"
        />
        Platform admin (full access to this panel, across all tenants)
        {isSelf ? (
          <span className="text-xs text-slate-400">
            — you can&apos;t demote yourself
          </span>
        ) : null}
      </label>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading
            ? "Saving…"
            : mode === "create"
              ? "Create user"
              : "Save changes"}
        </Button>
        {saved ? (
          <span className="text-sm font-medium text-green-700">Saved.</span>
        ) : null}
      </div>
    </form>
  );
}

export function DeleteUserButton({
  userId,
  userName,
  disabled,
}: {
  userId: string;
  userName: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (!window.confirm(`Delete ${userName}'s account? This cannot be undone.`))
      return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data: { error?: string } = await res.json();
        setError(data.error ?? "Could not delete user");
        return;
      }
      router.push("/admin/users");
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="danger"
        onClick={onDelete}
        disabled={loading || disabled}
      >
        {loading ? "Deleting…" : "Delete user"}
      </Button>
      {disabled ? (
        <p className="mt-1 text-xs text-slate-400">
          You cannot delete your own account.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
