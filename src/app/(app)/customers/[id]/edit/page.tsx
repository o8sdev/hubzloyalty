import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { tagsToArray } from "@/lib/validation";
import { CustomerForm } from "../../customer-form";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const customer = await db.customer.findFirst({
    where: { id, businessId: session.businessId },
  });
  if (!customer) notFound();

  return (
    <div>
      <PageHeader
        title="Edit customer"
        description={`Update ${customer.firstName}'s details.`}
      />
      <CustomerForm
        initial={{
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName ?? "",
          phone: customer.phone ?? "",
          email: customer.email ?? "",
          birthday: customer.birthday
            ? customer.birthday.toISOString().slice(0, 10)
            : "",
          marketingConsent: customer.marketingConsent,
          tags: tagsToArray(customer.tags).join(", "),
          notes: customer.notes ?? "",
        }}
      />
    </div>
  );
}
