"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";
import {
  AuthSubmitButton,
  Spinner,
  mktError,
  mktInput,
  mktLabel,
} from "@/components/marketing/auth";

/**
 * Shared password-change form. Used by the standalone /change-password page
 * (forced first-login change: requireCurrent=false, variant "mkt" — the
 * café-print auth surface) and the Settings Account card (voluntary change:
 * requireCurrent=true, variant "app" — the slate owner-app kit).
 */
export function ChangePasswordForm({
  requireCurrent,
  redirectTo,
  variant = "app",
}: {
  requireCurrent: boolean;
  redirectTo: string;
  variant?: "app" | "mkt";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Busy through the redirect so the user is never staring at a dead form.
  const [phase, setPhase] = useState<"idle" | "saving" | "redirecting">("idle");
  const busy = phase !== "idle";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setPhase("saving");
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          requireCurrent ? { currentPassword, newPassword } : { newPassword }
        ),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not change password");
        setPhase("idle");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (pathname === redirectTo) {
        // Already on the target page (Settings): show feedback instead of a
        // no-op navigation that would leave the user guessing.
        setSaved(true);
        setPhase("idle");
        router.refresh();
      } else {
        setPhase("redirecting");
        router.push(redirectTo);
        router.refresh();
      }
    } catch {
      setError("Network error — please try again");
      setPhase("idle");
    }
  }

  if (variant === "mkt") {
    return (
      <form onSubmit={onSubmit} className="space-y-5">
        {requireCurrent ? (
          <div>
            <label htmlFor="cp-current" className={mktLabel}>
              Current password
            </label>
            <input
              id="cp-current"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className={mktInput}
              disabled={busy}
            />
          </div>
        ) : null}
        <div>
          <label htmlFor="cp-new" className={mktLabel}>
            New password
          </label>
          <input
            id="cp-new"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            autoFocus
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            className={mktInput}
            disabled={busy}
          />
        </div>
        <div>
          <label htmlFor="cp-confirm" className={mktLabel}>
            Confirm new password
          </label>
          <input
            id="cp-confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat the password"
            className={mktInput}
            disabled={busy}
          />
        </div>
        {error ? <p className={mktError}>{error}</p> : null}
        <AuthSubmitButton
          loading={busy}
          loadingLabel={
            phase === "redirecting" ? "Pouring your dashboard…" : "Saving…"
          }
        >
          {requireCurrent ? "Change password" : "Set password"}{" "}
          <span aria-hidden>→</span>
        </AuthSubmitButton>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      {requireCurrent ? (
        <div>
          <Label htmlFor="cp-current">Current password</Label>
          <Input
            id="cp-current"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
      ) : null}
      <div>
        <Label htmlFor="cp-new">New password</Label>
        <Input
          id="cp-new"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="••••••••"
        />
        <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>
      </div>
      <div>
        <Label htmlFor="cp-confirm">Confirm new password</Label>
        <Input
          id="cp-confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy} aria-busy={busy}>
          {busy ? (
            <>
              <Spinner className="h-4 w-4" />
              Saving…
            </>
          ) : requireCurrent ? (
            "Change password"
          ) : (
            "Set password"
          )}
        </Button>
        {saved ? (
          <span className="text-sm font-medium text-green-700">
            Password changed.
          </span>
        ) : null}
      </div>
    </form>
  );
}
