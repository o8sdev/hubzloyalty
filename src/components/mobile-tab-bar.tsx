"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Native-style bottom tab bar for phones (hidden at md+, where the sidebar
// takes over). Thumb-reachable, safe-area aware, active tab = black pill to
// match the "selection is black" rule. Activity (audit log) lives one level in
// (dashboard peek + settings), keeping the bar to five focused destinations.
// ---------------------------------------------------------------------------

const TABS = [
  { href: "/dashboard", label: "Home", icon: "◧" },
  { href: "/counter", label: "Counter", icon: "▣" },
  { href: "/customers", label: "Guests", icon: "☺" },
  { href: "/reviews", label: "Reviews", icon: "★" },
  { href: "/settings", label: "Settings", icon: "⚙" },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex select-none flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors active:scale-95",
                  active ? "text-ink" : "text-ink-faint"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-7 w-11 items-center justify-center rounded-full text-base transition-colors",
                    active ? "bg-ink text-white" : "text-ink-soft"
                  )}
                >
                  {tab.icon}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
