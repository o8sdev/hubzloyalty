import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  LinkButton,
  StarRating,
  StatCard,
  TierBadge,
} from "@/components/ui";
import {
  formatDate,
  formatDateOnly,
  formatDateTime,
  formatMoney,
} from "@/lib/utils";
import { tagsToArray } from "@/lib/validation";
import { LogVisitButton } from "../log-visit-button";
import { DeleteCustomerButton } from "../delete-customer-button";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const customer = await db.customer.findFirst({
    where: { id, businessId: session.businessId },
    include: {
      visits: { orderBy: { visitedAt: "desc" }, take: 10 },
      reviews: { orderBy: { createdAt: "desc" }, take: 10 },
      rewardClaims: { where: { kind: "WELCOME" }, take: 1 },
    },
  });
  if (!customer) notFound();

  const welcomeClaim = customer.rewardClaims[0] ?? null;
  const welcomeClaimStatus = !welcomeClaim
    ? null
    : welcomeClaim.status === "PENDING" &&
        welcomeClaim.expiresAt &&
        welcomeClaim.expiresAt < new Date()
      ? "EXPIRED"
      : welcomeClaim.status;

  const name = customer.lastName
    ? `${customer.firstName} ${customer.lastName}`
    : customer.firstName;
  const tags = tagsToArray(customer.tags);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
            <TierBadge tier={customer.tier} />
            {tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Customer since {formatDate(customer.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton variant="secondary" href={`/customers/${customer.id}/edit`}>
            Edit
          </LinkButton>
          <LogVisitButton customerId={customer.id} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total visits" value={customer.totalVisits} />
        <StatCard label="Loyalty points" value={customer.loyaltyPoints} />
        <StatCard
          label="Total spend"
          value={formatMoney(customer.totalSpendCents)}
        />
        <StatCard label="Last visit" value={formatDate(customer.lastVisitAt)} />
      </div>

      {welcomeClaim ? (
        <Card className="mt-6">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                🎁 Welcome gift: {welcomeClaim.rewardText}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Code{" "}
                <span className="font-mono font-bold text-slate-700">
                  {welcomeClaim.code.length === 6
                    ? `${welcomeClaim.code.slice(0, 3)}-${welcomeClaim.code.slice(3)}`
                    : welcomeClaim.code}
                </span>
                {welcomeClaimStatus === "REDEEMED" && welcomeClaim.redeemedAt
                  ? ` · redeemed ${formatDate(welcomeClaim.redeemedAt)}`
                  : welcomeClaim.expiresAt
                    ? ` · valid until ${formatDate(welcomeClaim.expiresAt)}`
                    : ""}
              </p>
            </div>
            <Badge
              className={
                welcomeClaimStatus === "REDEEMED"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : welcomeClaimStatus === "EXPIRED"
                    ? "border-slate-200 bg-slate-50 text-slate-500"
                    : "border-amber-300 bg-amber-50 text-amber-700"
              }
            >
              {welcomeClaimStatus === "PENDING" ? "waiting to be claimed" : welcomeClaimStatus?.toLowerCase()}
            </Badge>
          </CardBody>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Recent visits */}
        <Card>
          <CardHeader title="Recent visits" description="Last 10 visits" />
          <CardBody className="px-0 py-0">
            {customer.visits.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">
                No visits logged yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {customer.visits.map((visit) => (
                  <li
                    key={visit.id}
                    className="flex items-start justify-between gap-4 px-5 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {formatDateTime(visit.visitedAt)}
                      </p>
                      {visit.note ? (
                        <p className="mt-0.5 text-sm text-slate-500">
                          {visit.note}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                      {visit.amountCents > 0
                        ? formatMoney(visit.amountCents)
                        : "—"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Recent feedback */}
        <Card>
          <CardHeader title="Recent feedback" description="Last 10 reviews" />
          <CardBody className="px-0 py-0">
            {customer.reviews.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">
                No feedback yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {customer.reviews.map((review) => (
                  <li key={review.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <StarRating rating={review.rating} />
                      <p className="text-xs text-slate-400">
                        {formatDate(review.createdAt)}
                      </p>
                    </div>
                    {review.comment ? (
                      <p className="mt-1 text-sm text-slate-600">
                        {review.comment}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader title="Contact" />
          <CardBody className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Phone</span>
              <span className="text-slate-900">{customer.phone ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Email</span>
              <span className="text-slate-900">{customer.email ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Birthday</span>
              <span className="text-slate-900">
                {formatDateOnly(customer.birthday)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Marketing</span>
              {customer.marketingConsent ? (
                <span className="font-medium text-green-700">
                  Marketing consent given
                </span>
              ) : (
                <span className="text-slate-500">No marketing consent</span>
              )}
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Source</span>
              <Badge>{customer.source}</Badge>
            </div>
          </CardBody>
        </Card>

        {/* Notes */}
        {customer.notes ? (
          <Card>
            <CardHeader title="Notes" />
            <CardBody>
              <p className="whitespace-pre-wrap text-sm text-slate-600">
                {customer.notes}
              </p>
            </CardBody>
          </Card>
        ) : null}
      </div>

      {/* Danger zone */}
      <Card className="mt-6 border-red-200">
        <CardHeader
          title="Danger zone"
          description="Deleting a customer permanently removes their visits and feedback."
        />
        <CardBody>
          <DeleteCustomerButton customerId={customer.id} customerName={name} />
        </CardBody>
      </Card>
    </div>
  );
}
