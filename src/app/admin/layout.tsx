import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/session";
import { AdminNav } from "@/components/admin-nav";
import { LogoutButton } from "@/components/logout-button";
import { HubzWordmark } from "@/components/brand";

/**
 * Platform-admin shell. Deliberately dark so it's impossible to confuse
 * with a tenant's (light) dashboard while operating across businesses.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requirePlatformAdmin();
  // Same one-time-password enforcement as the tenant app shell.
  if (session.mustChangePassword) redirect("/change-password");

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 flex-col bg-slate-900 px-4 py-6 md:flex">
        <Link href="/admin" className="mb-1 flex px-2">
          <HubzWordmark variant="dark" imgClassName="h-6 w-auto" />
        </Link>
        <p className="mb-8 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Platform admin
        </p>
        <AdminNav />
        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="flex items-center justify-between px-2">
            <p className="truncate text-xs text-slate-400">{session.email}</p>
            <span className="[&_button]:text-slate-400 [&_button:hover]:bg-white/10 [&_button:hover]:text-white">
              <LogoutButton />
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex w-full flex-col">
        <header className="flex items-center justify-between bg-slate-900 px-4 py-3 md:hidden">
          <Link href="/admin" className="flex items-center gap-2">
            <HubzWordmark variant="dark" imgClassName="h-5 w-auto" showTag={false} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
              Admin
            </span>
          </Link>
          <nav className="flex gap-3 text-xs font-medium text-slate-300">
            <Link href="/admin">Home</Link>
            <Link href="/admin/businesses">Businesses</Link>
            <Link href="/admin/users">Users</Link>
            <Link href="/admin/system">System</Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
