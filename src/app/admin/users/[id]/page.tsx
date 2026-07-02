import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { AdminUserForm, DeleteUserButton } from "../user-form";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePlatformAdmin();
  const { id } = await params;

  const [user, businesses] = await Promise.all([
    db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        businessId: true,
        isPlatformAdmin: true,
        createdAt: true,
      },
    }),
    db.business.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!user) notFound();

  return (
    <div>
      <PageHeader
        title={user.name}
        description={`${user.email} · joined ${formatDate(user.createdAt)}`}
      />
      <div className="space-y-6">
        <Card className="max-w-2xl">
          <CardHeader title="Account" />
          <CardBody>
            <AdminUserForm
              mode="edit"
              businesses={businesses}
              selfId={session.userId}
              initial={{
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                businessId: user.businessId,
                isPlatformAdmin: user.isPlatformAdmin,
              }}
            />
          </CardBody>
        </Card>

        <Card className="max-w-2xl border-red-200">
          <CardHeader title="Danger zone" />
          <CardBody>
            <DeleteUserButton
              userId={user.id}
              userName={user.name}
              disabled={user.id === session.userId}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
