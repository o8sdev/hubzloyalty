"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Input, Label } from "@/components/ui";

type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  isSelf: boolean;
};

export function TeamCard({
  canEdit,
  members,
}: {
  canEdit: boolean;
  members: Member[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [invited, setInvited] = useState<{
    email: string;
    oneTimePassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInvited(null);
    setLoading(true);
    try {
      const res = await fetch("/api/business/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not invite the staff member");
        return;
      }
      setInvited({ email: data.email, oneTimePassword: data.oneTimePassword });
      setName("");
      setEmail("");
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string, memberName: string) {
    if (!window.confirm(`Remove ${memberName} from your team?`)) return;
    setRemoving(id);
    setError(null);
    try {
      const res = await fetch(`/api/business/team/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data: { error?: string } = await res.json();
        setError(data.error ?? "Could not remove the team member");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setRemoving(null);
    }
  }

  async function copyOtp() {
    if (!invited) return;
    try {
      await navigator.clipboard.writeText(invited.oneTimePassword);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Selection fallback is the visible code itself.
    }
  }

  return (
    <div className="space-y-5">
      <ul className="divide-y divide-slate-100">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">
                {m.name}
                {m.isSelf ? (
                  <span className="ml-1.5 text-xs text-slate-400">(you)</span>
                ) : null}
              </p>
              <p className="truncate text-xs text-slate-400">{m.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge
                className={
                  m.role === "OWNER"
                    ? "border-brand-200 bg-brand-50 text-brand-800"
                    : ""
                }
              >
                {m.role}
              </Badge>
              {canEdit && !m.isSelf && m.role === "STAFF" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(m.id, m.name)}
                  disabled={removing !== null}
                >
                  {removing === m.id ? "…" : "Remove"}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {invited ? (
        <div className="rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-slate-900">
            Staff account created for {invited.email}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Share this one-time password — it&apos;s shown only once. They&apos;ll
            choose their own password at first login.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded-lg bg-white px-3 py-2 font-mono text-base font-bold tracking-wider text-slate-900">
              {invited.oneTimePassword}
            </code>
            <Button variant="secondary" size="sm" onClick={copyOtp}>
              {copied ? "Copied ✓" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}

      {canEdit ? (
        <form onSubmit={invite} className="space-y-3 border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-slate-800">Invite staff</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="team-name">Name</Label>
              <Input
                id="team-name"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Aysel"
              />
            </div>
            <div>
              <Label htmlFor="team-email">Email</Label>
              <Input
                id="team-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aysel@yourcafe.com"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Staff can confirm guest codes at the counter (from the Counter
            screen on their phone) — they can&apos;t change your settings.
          </p>
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create staff account"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
