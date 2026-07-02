import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { AdminUserForm } from "../user-form";

export default async function AdminNewUserPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const session = await requirePlatformAdmin();
  const { businessId } = await searchParams;

  const businesses = await db.business.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <PageHeader
        title="New user"
        description="Create a member account for a business, or a platform-only account."
      />
      <Card className="max-w-2xl">
        <CardHeader title="Account" />
        <CardBody>
          <AdminUserForm
            mode="create"
            businesses={businesses}
            selfId={session.userId}
            initial={
              businessId
                ? {
                    id: "",
                    name: "",
                    email: "",
                    role: "STAFF",
                    businessId,
                    isPlatformAdmin: false,
                  }
                : undefined
            }
          />
        </CardBody>
      </Card>
    </div>
  );
}
