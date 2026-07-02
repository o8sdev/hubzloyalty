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

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePlatformAdmin();
  const { q } = await searchParams;

  const where: Prisma.BusinessWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          {
            users: {
              some: { email: { contains: q, mode: "insensitive" } },
            },
          },
        ],
      }
    : {};

  const businesses = await db.business.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      suspendedAt: true,
      users: {
        where: { role: "OWNER" },
        select: { email: true },
        take: 1,
      },
      _count: { select: { customers: true, reviews: true, users: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Businesses"
        description="Every tenant on the platform."
        action={<LinkButton href="/admin/businesses/new">New business</LinkButton>}
      />

      <form method="GET" className="mb-4 max-w-sm">
        <Input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name, slug, or owner email…"
        />
      </form>

      {businesses.length === 0 ? (
        <EmptyState
          title={q ? "No businesses match" : "No businesses yet"}
          description={
            q
              ? "Try a different search."
              : "Create the first tenant to get going."
          }
          action={
            q ? undefined : (
              <LinkButton href="/admin/businesses/new">New business</LinkButton>
            )
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Business</th>
                <th className="px-5 py-3 font-medium">Owner</th>
                <th className="px-5 py-3 font-medium">Customers</th>
                <th className="px-5 py-3 font-medium">Reviews</th>
                <th className="px-5 py-3 font-medium">Members</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {businesses.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/businesses/${b.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {b.name}
                    </Link>
                    <p className="text-xs text-slate-400">/r/{b.slug}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {b.users[0]?.email ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{b._count.customers}</td>
                  <td className="px-5 py-3 text-slate-600">{b._count.reviews}</td>
                  <td className="px-5 py-3 text-slate-600">{b._count.users}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {formatDate(b.createdAt)}
                  </td>
                  <td className="px-5 py-3">
                    {b.suspendedAt ? (
                      <Badge className="border-red-200 bg-red-50 text-red-700">
                        Suspended
                      </Badge>
                    ) : (
                      <Badge className="border-green-200 bg-green-50 text-green-700">
                        Active
                      </Badge>
                    )}
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
