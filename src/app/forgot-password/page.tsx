"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AuthShell,
  AuthSubmitButton,
  mktError,
  mktInput,
  mktLabel,
} from "@/components/marketing/auth";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const linkExpired = searchParams.get("error") === "expired";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data: { error?: string } = await res.json();
        setError(data.error ?? "Something went wrong — please try again");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="password reset"
      title={
        <>
          Locked <span className="italic text-ember">out?</span>
        </>
      }
      subtitle={
        sent
          ? undefined
          : "Enter your account email and we'll send you a one-time reset link."
      }
      below={
        <p>
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-ember hover:underline">
            Back to login →
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="py-4 text-center">
          <span
            aria-hidden
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-moss text-lg font-bold text-cream"
          >
            ✉
          </span>
          <p className="f-display mt-5 text-xl font-semibold">Check your inbox.</p>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">
            If an account exists for <strong>{email}</strong>, a reset link is on
            its way. It works once and expires in 1 hour.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          {linkExpired ? (
            <p className="rounded-xl border border-ink/15 bg-paper px-4 py-3 text-sm text-ink-soft">
              That reset link was invalid or had expired — request a fresh one
              below.
            </p>
          ) : null}
          <div>
            <label htmlFor="email" className={mktLabel}>
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourcafe.com"
              className={mktInput}
              disabled={loading}
            />
          </div>
          {error ? <p className={mktError}>{error}</p> : null}
          <AuthSubmitButton loading={loading} loadingLabel="Sending the link…">
            Send reset link <span aria-hidden>→</span>
          </AuthSubmitButton>
        </form>
      )}
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
