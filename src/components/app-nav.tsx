"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "◧" },
  { href: "/customers", label: "Customers", icon: "☺" },
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
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-brand-700 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <span className="w-4 text-center" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
      <div className="mt-4 border-t border-slate-200 pt-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Coming soon
        </p>
        {COMING_SOON.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-300"
          >
            {item.label}
            <span className="text-[10px] text-slate-300">{item.phase}</span>
          </div>
        ))}
      </div>
    </nav>
  );
}
