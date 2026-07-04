"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GuestLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/guest/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm font-semibold text-ink-soft hover:bg-paper disabled:opacity-50"
    >
      {loading ? "…" : "Log out"}
    </button>
  );
}
