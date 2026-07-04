"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Guest app bottom tab bar (consumer side). Mobile-first; Scan is the primary
// action (always black). Wired in Phase G1; screens fill in G2–G4.
// ---------------------------------------------------------------------------

const TABS = [
  { href: "/guest/discover", label: "Discover", icon: "⌕" },
  { href: "/guest/scan", label: "Scan", icon: "▣", primary: true },
  { href: "/guest/wallet", label: "Wallet", icon: "◈" },
  { href: "/guest/profile", label: "Profile", icon: "☺" },
] as const;

export function GuestTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Guest"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-ink/10 bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <ul className="flex items-stretch">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          const filled = active || "primary" in tab;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex select-none flex-col items-center gap-0.5 py-2 text-[10px] font-medium active:scale-95",
                  active ? "text-ink" : "text-ink-faint"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-7 w-11 items-center justify-center rounded-full text-base transition-colors",
                    filled ? "bg-ink text-white" : "text-ink-soft"
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
