"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: "◧", exact: true },
  { href: "/admin/demo-requests", label: "Demo requests", icon: "☏", exact: false },
  { href: "/admin/businesses", label: "Businesses", icon: "⌂", exact: false },
  { href: "/admin/users", label: "Users", icon: "☺", exact: false },
  { href: "/admin/reviews", label: "Reviews", icon: "★", exact: false },
  { href: "/admin/activity", label: "Activity", icon: "≡", exact: false },
  { href: "/admin/emails", label: "Emails", icon: "✉", exact: false },
  { href: "/admin/system", label: "System", icon: "⚙", exact: false },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-white/10 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            )}
          >
            <span className="w-4 text-center" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
