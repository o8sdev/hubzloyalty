import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { NewBusinessForm } from "./new-business-form";

/**
 * Concierge onboarding: create the tenant and its owner account in one go.
 * With ?fromRequest=<id> the form is prefilled from a DemoRequest, which the
 * API marks CONVERTED in the same transaction that creates the business.
 */
export default async function AdminNewBusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ fromRequest?: string }>;
}) {
  await requirePlatformAdmin();
  const { fromRequest } = await searchParams;

  const demoRequest = fromRequest
    ? await db.demoRequest.findUnique({ where: { id: fromRequest } })
    : null;
  if (fromRequest && !demoRequest) notFound();
  // Only workable leads are convertible; a stale tab pointing at a request
  // another admin already converted/dismissed falls back to a blank form
  // (the API guards this too — this just avoids a misleading banner).
  const convertible =
    demoRequest &&
    (demoRequest.status === "NEW" || demoRequest.status === "CONTACTED")
      ? demoRequest
      : null;

  return (
    <div>
      <PageHeader
        title="New business"
        description="Concierge onboarding: create the tenant and its owner account in one go."
      />
      {convertible ? (
        <div className="mb-4 max-w-xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Converting demo request from{" "}
          <span className="font-semibold">{convertible.contactName}</span> (
          {convertible.email})
        </div>
      ) : null}
      {demoRequest && !convertible ? (
        <div className="mb-4 max-w-xl rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-600">
          The linked demo request is {demoRequest.status.toLowerCase()} and
          can&apos;t be converted — creating this business will not touch it.
        </div>
      ) : null}
      <NewBusinessForm
        prefill={
          convertible
            ? {
                demoRequestId: convertible.id,
                name: convertible.businessName,
                ownerName: convertible.contactName,
                ownerEmail: convertible.email,
              }
            : undefined
        }
      />
    </div>
  );
}
