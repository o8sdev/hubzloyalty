"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";

/**
 * Shared password-change form. Used by the standalone /change-password page
 * (forced first-login change: requireCurrent=false) and the Settings Account
 * card (voluntary change: requireCurrent=true).
 */
export function ChangePasswordForm({
  requireCurrent,
  redirectTo,
}: {
  requireCurrent: boolean;
  redirectTo: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
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
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (pathname === redirectTo) {
        // Already on the target page (Settings): show feedback instead of a
        // no-op navigation that would leave the user guessing.
        setSaved(true);
        router.refresh();
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
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
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : requireCurrent ? "Change password" : "Set password"}
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
