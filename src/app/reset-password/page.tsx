"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Input, Label } from "@/components/ui";

/**
 * Reached from the emailed recovery link: /auth/confirm verified the token
 * and established a session, so this page just collects the new password.
 * Without that session the API answers 400 and we point back to the form.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(false);

  // If someone lands here without a recovery session (bookmark, stale tab),
  // show the "request a new link" state instead of a doomed form.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => {
        if (!cancelled && r.status === 401) setExpired(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not reset password");
        return;
      }
      setDone(true);
      window.setTimeout(() => router.push("/login"), 1500);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  if (expired) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-md p-8">
          <h1 className="text-xl font-bold text-slate-900">Link expired</h1>
          <p className="mt-2 text-sm text-slate-500">
            This reset link is no longer valid. Request a fresh one — it only
            takes a moment.
          </p>
          <p className="mt-6 text-center text-sm">
            <Link
              href="/forgot-password"
              className="font-medium text-brand-700 hover:underline"
            >
              Request a new reset link
            </Link>
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-xl font-bold text-slate-900">Choose a new password</h1>
        {done ? (
          <p className="mt-4 rounded-lg bg-green-50 px-3 py-3 text-sm text-green-800">
            Password updated — taking you to login…
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat the password"
              />
            </div>
            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving…" : "Set new password"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
