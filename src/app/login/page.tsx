"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, Input, Label } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
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
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md p-8">
      <h1 className="text-xl font-bold text-slate-900">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-500">
        Log in to your LoyaltyCRM dashboard.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourcafe.com"
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Logging in…" : "Log in"}
        </Button>
        <p className="text-center">
          <Link
            href="/forgot-password"
            className="text-sm text-slate-500 hover:text-brand-700 hover:underline"
          >
            Forgot your password?
          </Link>
        </p>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Want LoyaltyCRM for your business?{" "}
        <Link
          href="/request-demo"
          className="font-medium text-brand-700 hover:underline"
        >
          Request a demo
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
