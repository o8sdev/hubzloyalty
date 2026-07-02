import { requireSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "../customer-form";

export default async function NewCustomerPage() {
  await requireSession();

  return (
    <div>
      <PageHeader
        title="Add customer"
        description="Manually add a guest to your customer base."
      />
      <CustomerForm />
    </div>
  );
}
