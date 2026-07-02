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
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 flex-col border-r border-slate-200 bg-white px-4 py-6 md:flex">
        <Link
          href="/dashboard"
          className="mb-8 flex items-center gap-2 px-2 text-base font-bold text-brand-800"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-700 text-xs font-black text-white">
            L
          </span>
          LoyaltyCRM
        </Link>
        <AppNav />
        <div className="mt-auto border-t border-slate-200 pt-4">
          <p className="truncate px-2 text-sm font-medium text-slate-700">
            {business?.name ?? "Your business"}
          </p>
          <div className="flex items-center justify-between px-2 pt-1">
            <p className="truncate text-xs text-slate-400">{session.name}</p>
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex w-full flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-bold text-brand-800"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-700 text-[10px] font-black text-white">
              L
            </span>
            LoyaltyCRM
          </Link>
          <nav className="flex gap-3 text-xs font-medium text-slate-600">
            <Link href="/dashboard">Home</Link>
            <Link href="/customers">Customers</Link>
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
