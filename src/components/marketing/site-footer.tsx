import Link from "next/link";
import { HubzWordmark } from "@/components/brand";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#how", label: "How it works" },
      { href: "/#product", label: "The tour" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/r/demo-cafe", label: "Guest demo ↗" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/#numbers", label: "The numbers" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Get in",
    links: [
      { href: "/request-demo", label: "Request a demo" },
      { href: "/login", label: "Log in" },
      { href: "/forgot-password", label: "Reset password" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-ink text-cream">
      <div className="mx-auto max-w-6xl px-5 pb-10 pt-16 sm:px-8">
        <div className="flex flex-col justify-between gap-12 md:flex-row">
          <div className="max-w-sm">
            <HubzWordmark
              variant="dark"
              imgClassName="h-9 w-auto"
              tagClassName="text-cream/50 text-[10px]"
            />
            <p className="mt-4 text-sm leading-relaxed text-cream/60">
              The QR on the counter that collects Google reviews, catches
              complaints before they go public, and builds the guest list your
              café never had.
            </p>
            <p className="f-mono mt-6 inline-block rounded-full border border-cream/25 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-cream/70">
              Ungated · Google-policy &amp; FTC compliant
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="f-mono text-[10px] uppercase tracking-[0.22em] text-cream/40">
                  {col.title}
                </p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.href + link.label}>
                      <Link
                        href={link.href}
                        className="mkt-link text-sm text-cream/75 hover:text-cream"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mkt-rule mt-14 text-cream" />

        <div className="f-mono mt-6 flex flex-col items-start justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-cream/40 sm:flex-row sm:items-center">
          <p>© 2026 HUBz Loyalty · brewed for hospitality</p>
          <p>table 12 is waiting ★</p>
        </div>
      </div>

      {/* Giant ghost wordmark */}
      <p
        aria-hidden
        className="f-display pointer-events-none select-none whitespace-nowrap text-center text-[18vw] font-bold leading-[0.72] tracking-tight text-cream/[0.045]"
      >
        regulars
      </p>
    </footer>
  );
}
