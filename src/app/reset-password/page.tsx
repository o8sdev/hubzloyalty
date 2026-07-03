"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AuthShell,
  AuthSubmitButton,
  mktError,
  mktInput,
  mktLabel,
} from "@/components/marketing/auth";

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
        setLoading(false);
        return;
      }
      setDone(true);
      window.setTimeout(() => router.push("/login"), 1500);
    } catch {
      setError("Network error — please try again");
      setLoading(false);
    }
  }

  if (expired) {
    return (
      <AuthShell
        eyebrow="password reset"
        title={
          <>
            Link <span className="italic text-ember">expired.</span>
          </>
        }
        subtitle="This reset link is no longer valid. Request a fresh one — it only takes a moment."
        below={
          <p>
            <Link
              href="/forgot-password"
              className="font-semibold text-ember hover:underline"
            >
              Request a new reset link →
            </Link>
          </p>
        }
      >
        <p className="f-mono text-center text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          links work once · expire in 1 hour
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="password reset"
      title={
        <>
          Choose a <span className="italic text-ember">new one.</span>
        </>
      }
      subtitle={done ? undefined : "At least 8 characters. Make it yours."}
      below={
        <p>
          <Link href="/login" className="font-semibold text-ember hover:underline">
            Back to login →
          </Link>
        </p>
      }
    >
      {done ? (
        <div className="py-4 text-center">
          <span
            aria-hidden
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-moss text-lg font-bold text-cream"
          >
            ✓
          </span>
          <p className="f-display mt-5 text-xl font-semibold">Password updated.</p>
          <p className="mt-2 text-sm text-ink-soft">Taking you to login…</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label htmlFor="password" className={mktLabel}>
              New password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={mktInput}
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="confirm" className={mktLabel}>
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat the password"
              className={mktInput}
              disabled={loading}
            />
          </div>
          {error ? <p className={mktError}>{error}</p> : null}
          <AuthSubmitButton loading={loading} loadingLabel="Saving…">
            Set new password <span aria-hidden>→</span>
          </AuthSubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
