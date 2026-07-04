import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { LogoutButton } from "@/components/logout-button";
import { HubzWordmark } from "@/components/brand";
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
        <Link href="/dashboard" className="mb-1 flex px-2">
          <HubzWordmark variant="light" imgClassName="h-6 w-auto" />
        </Link>
        <p className="mb-7 px-2 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-faint">
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
              className="mx-2 mt-1 inline-block rounded-full border border-ink/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint transition-colors hover:border-ink hover:text-ink"
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

      {/* Mobile shell: sticky top bar (notch-safe) + bottom tab bar */}
      <div className="flex w-full flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink/10 bg-cream/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)_+_0.75rem)] backdrop-blur-md md:hidden">
          <Link href="/dashboard" className="flex">
            <HubzWordmark variant="light" imgClassName="h-5 w-auto" />
          </Link>
          <LogoutButton />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 sm:px-6 md:pb-6 lg:px-8">
          {children}
        </main>
        <MobileTabBar />
      </div>
    </div>
  );
}
