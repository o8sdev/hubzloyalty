"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "◧" },
  { href: "/customers", label: "Guests", icon: "☺" },
  { href: "/reviews", label: "Reviews", icon: "★" },
  { href: "/settings", label: "Settings", icon: "⚙" },
] as const;

const COMING_SOON = [
  { label: "Loyalty", phase: "Phase 3" },
  { label: "Campaigns", phase: "Phase 4" },
  { label: "Analytics", phase: "Phase 6" },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
              active
                ? "bg-brand-700 text-white shadow-[0_8px_18px_-10px_rgb(212_85_30/0.7)]"
                : "text-ink-soft hover:translate-x-0.5 hover:bg-paper-deep/60 hover:text-ink"
            )}
          >
            <span className="w-4 text-center" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
      <div className="mt-4 border-t border-ink/10 pt-4">
        <p className="mb-2 px-3 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-faint/70">
          Coming soon
        </p>
        {COMING_SOON.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-ink-faint/60"
          >
            {item.label}
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint/50">
              {item.phase}
            </span>
          </div>
        ))}
      </div>
    </nav>
  );
}
