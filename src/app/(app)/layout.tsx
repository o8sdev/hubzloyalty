import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { LogoutButton } from "@/components/logout-button";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();
  // One-time-password accounts must set their own password before using the app.
  if (session.mustChangePassword) redirect("/change-password");
  // Platform-only accounts (no business) live in /admin, not here.
  if (!session.businessId) {
    redirect(session.platformAdmin ? "/admin" : "/login");
  }
  const business = await db.business.findUnique({
    where: { id: session.businessId },
    select: { name: true, slug: true },
  });

  return (
    <div className="flex min-h-screen bg-paper">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 flex-col border-r border-ink/10 bg-cream px-4 py-6 md:flex">
        <Link href="/dashboard" className="group mb-1 flex items-baseline gap-2 px-2">
          <span className="flex h-7 w-7 items-center justify-center self-center rounded-full bg-brand-700 text-xs font-black text-white transition-transform duration-300 group-hover:rotate-[15deg]">
            L
          </span>
          <span className="f-display text-lg font-semibold tracking-tight text-ink">
            LoyaltyCRM
          </span>
        </Link>
        <p className="mb-7 px-2 pl-11 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-faint">
          guest book
        </p>
        <AppNav />
        <div className="mt-auto border-t border-ink/10 pt-4">
          <p className="f-display truncate px-2 text-sm font-semibold text-ink">
            {business?.name ?? "Your business"}
          </p>
          {business?.slug ? (
            <Link
              href={`/r/${business.slug}`}
              target="_blank"
              className="mx-2 mt-1 inline-block rounded-full border border-ink/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint transition-colors hover:border-brand-700 hover:text-brand-700"
            >
              /r/{business.slug} ↗
            </Link>
          ) : null}
          <div className="flex items-center justify-between px-2 pt-2">
            <p className="truncate text-xs text-ink-faint">{session.name}</p>
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex w-full flex-col">
        <header className="flex items-center justify-between border-b border-ink/10 bg-cream px-4 py-3 md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-700 text-[10px] font-black text-white">
              L
            </span>
            <span className="f-display text-sm font-semibold text-ink">LoyaltyCRM</span>
          </Link>
          <nav className="flex gap-3 text-xs font-medium text-ink-soft">
            <Link href="/dashboard">Home</Link>
            <Link href="/customers">Guests</Link>
            <Link href="/reviews">Reviews</Link>
            <Link href="/settings">Settings</Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
