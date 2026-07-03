"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AuthShell,
  AuthSubmitButton,
  mktError,
  mktInput,
  mktLabel,
} from "@/components/marketing/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "idle" → "authenticating" (request in flight) → "redirecting" (success,
  // navigation + server render in progress). The button stays busy through
  // BOTH so the user is never staring at a dead form.
  const [phase, setPhase] = useState<"idle" | "authenticating" | "redirecting">(
    "idle"
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase("authenticating");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        setPhase("idle");
        return;
      }
      setPhase("redirecting");
      // Forced first-login password change takes precedence over both the
      // admin home and any ?next target.
      if (data.mustChangePassword) {
        router.push("/change-password");
        router.refresh();
        return;
      }
      const next = searchParams.get("next");
      // Same-origin paths only: "//evil.com" and "/\evil.com" both resolve
      // cross-origin, so a bare startsWith("/") check is an open redirect.
      const fallback = data.admin ? "/admin" : "/dashboard";
      const safeNext =
        next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
          ? next
          : fallback;
      router.push(safeNext);
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setPhase("idle");
    }
  }

  const busy = phase !== "idle";

  return (
    <AuthShell
      eyebrow="owner login"
      title={
        <>
          Welcome <span className="italic text-ember">back.</span>
        </>
      }
      subtitle="Sign in to your dashboard — the inbox, the list, the numbers."
      below={
        <p>
          New here?{" "}
          <Link href="/request-demo" className="font-semibold text-ember hover:underline">
            Request a demo →
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
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
            disabled={busy}
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className={mktLabel}>
              Password
            </label>
            <Link
              href="/forgot-password"
              className="f-mono mb-1.5 text-[10px] uppercase tracking-[0.14em] text-ember hover:underline"
              tabIndex={busy ? -1 : 0}
            >
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`${mktInput} pr-16`}
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              disabled={busy}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="f-mono absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-1 text-[10px] uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-ember"
            >
              {showPassword ? "hide" : "show"}
            </button>
          </div>
        </div>

        {error ? <p className={mktError}>{error}</p> : null}

        <AuthSubmitButton
          loading={busy}
          loadingLabel={
            phase === "redirecting" ? "Pouring your dashboard…" : "Signing you in…"
          }
        >
          Log in <span aria-hidden>→</span>
        </AuthSubmitButton>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
