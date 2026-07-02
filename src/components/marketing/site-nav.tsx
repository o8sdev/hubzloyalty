"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/#how", label: "How it works" },
  { href: "/#product", label: "Product" },
  { href: "/#numbers", label: "Numbers" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/about", label: "About" },
] as const;

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile panel on navigation.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-paper/90 shadow-[0_1px_0_rgb(33_23_17/0.12),0_12px_32px_-20px_rgb(33_23_17/0.35)] backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        {/* Wordmark */}
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="flex h-8 w-8 items-center justify-center self-center rounded-full bg-ember text-sm font-black text-cream transition-transform duration-300 group-hover:rotate-[15deg]">
            L
          </span>
          <span className="f-display text-xl font-semibold tracking-tight">
            LoyaltyCRM
          </span>
        </Link>

        {/* Desktop tabs */}
        <div className="hidden items-center gap-7 md:flex">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`mkt-link text-[0.9rem] font-medium ${
                pathname === tab.href ? "text-ember" : "text-ink-soft hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="mkt-link text-[0.9rem] font-medium text-ink-soft hover:text-ink">
            Log in
          </Link>
          <Link href="/register" className="mkt-btn mkt-btn-ink px-5 py-2.5 text-sm">
            Start free
          </Link>
        </div>

        {/* Mobile burger */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 flex-col items-center justify-center gap-[5px] md:hidden"
        >
          <span
            className={`h-[2px] w-5 bg-ink transition-transform duration-300 ${open ? "translate-y-[7px] rotate-45" : ""}`}
          />
          <span className={`h-[2px] w-5 bg-ink transition-opacity duration-300 ${open ? "opacity-0" : ""}`} />
          <span
            className={`h-[2px] w-5 bg-ink transition-transform duration-300 ${open ? "-translate-y-[7px] -rotate-45" : ""}`}
          />
        </button>
      </nav>

      {/* Mobile panel */}
      <div
        className={`grid overflow-hidden bg-paper/95 backdrop-blur-md transition-[grid-template-rows] duration-400 md:hidden ${
          open ? "grid-rows-[1fr] shadow-[0_24px_40px_-24px_rgb(33_23_17/0.4)]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-1 px-6 pb-6 pt-2">
            {TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setOpen(false)}
                className="f-display border-b border-ink/10 py-3 text-lg font-medium"
              >
                {tab.label}
              </Link>
            ))}
            <div className="mt-4 flex gap-3">
              <Link href="/login" className="mkt-btn mkt-btn-ghost flex-1 px-5 py-3 text-sm">
                Log in
              </Link>
              <Link href="/register" className="mkt-btn mkt-btn-primary flex-1 px-5 py-3 text-sm">
                Start free
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
