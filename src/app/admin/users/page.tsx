import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";
import {
  Badge,
  Card,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePlatformAdmin();
  const { q } = await searchParams;

  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { business: { name: { contains: q, mode: "insensitive" } } },
        ],
      }
    : {};

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isPlatformAdmin: true,
      createdAt: true,
      business: { select: { id: true, name: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Users"
        description="Every account across the platform."
        action={<LinkButton href="/admin/users/new">New user</LinkButton>}
      />

      <form method="GET" className="mb-4 max-w-sm">
        <Input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name, email, or business…"
        />
      </form>

      {users.length === 0 ? (
        <EmptyState title="No users match" description="Try a different search." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-5 py-3 font-medium">Business</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    {u.business ? (
                      <Link
                        href={`/admin/businesses/${u.business.id}`}
                        className="text-slate-700 hover:underline"
                      >
                        {u.business.name}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-slate-600">{u.role}</span>
                    {u.isPlatformAdmin ? (
                      <Badge className="ml-2 border-amber-300 bg-amber-50 text-amber-700">
                        Platform admin
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-sm font-medium text-brand-700 hover:underline"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
