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
  cn,
  formatDate,
  formatDateOnly,
  formatDateTime,
  formatMoney,
} from "@/lib/utils";
import { tagsToArray } from "@/lib/validation";
import { avatarTone, initials } from "@/lib/avatar";
import { LogVisitButton } from "../log-visit-button";
import { RedeemRewardButton } from "../redeem-reward-button";
import { DeleteCustomerButton } from "../delete-customer-button";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const isOwner = session.role === "OWNER";

  const [customer, activeRewards] = await Promise.all([
    db.customer.findFirst({
      where: { id, businessId: session.businessId },
      include: {
        visits: { orderBy: { visitedAt: "desc" }, take: 10 },
        reviews: { orderBy: { createdAt: "desc" }, take: 10 },
        rewardClaims: { where: { kind: "WELCOME" }, take: 1 },
        redemptions: {
          where: { status: "CONFIRMED" },
          orderBy: { redeemedAt: "desc" },
          take: 10,
        },
      },
    }),
    db.reward.findMany({
      where: { businessId: session.businessId, active: true },
      orderBy: { pointsCost: "asc" },
      select: { id: true, name: true, pointsCost: true },
    }),
  ]);
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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-sm",
              avatarTone(name)
            )}
          >
            {initials(customer.firstName, customer.lastName)}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-ink">{name}</h1>
              <TierBadge tier={customer.tier} />
              {tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
            <p className="mt-1 text-sm text-ink-faint">
              Guest since {formatDate(customer.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RedeemRewardButton
            customerId={customer.id}
            balance={customer.loyaltyPoints}
            rewards={activeRewards}
          />
          <LinkButton variant="secondary" href={`/customers/${customer.id}/edit`}>
            Edit
          </LinkButton>
          <LogVisitButton customerId={customer.id} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total visits" value={customer.totalVisits} icon="☕" />
        <StatCard label="Loyalty points" value={customer.loyaltyPoints} icon="✦" />
        <StatCard
          label="Total spend"
          value={formatMoney(customer.totalSpendCents)}
          icon="💳"
        />
        <StatCard label="Last visit" value={formatDate(customer.lastVisitAt)} icon="🕐" />
      </div>

      {welcomeClaim ? (
        <Card className="mt-6 border-gold/40 bg-gradient-to-br from-gold/10 to-cream">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">
                🎁 Welcome gift: {welcomeClaim.rewardText}
              </p>
              <p className="mt-0.5 text-xs text-ink-soft">
                Code{" "}
                <span className="font-mono font-bold text-ink">
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
                  ? "border-moss/30 bg-moss/10 text-moss"
                  : welcomeClaimStatus === "EXPIRED"
                    ? "border-ink/15 bg-paper text-ink-faint"
                    : "border-slate-300 bg-slate-100 text-slate-600"
              }
            >
              {welcomeClaimStatus === "PENDING" ? "waiting to be claimed" : welcomeClaimStatus?.toLowerCase()}
            </Badge>
          </CardBody>
        </Card>
      ) : null}

      {customer.redemptions.length > 0 ? (
        <Card className="mt-6">
          <CardHeader title="Redemptions" description="Points spent on rewards" />
          <CardBody className="px-0 py-0">
            <ul className="divide-y divide-ink/5">
              {customer.redemptions.map((rd) => (
                <li
                  key={rd.id}
                  className="flex items-start justify-between gap-4 px-5 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">{rd.rewardName}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {formatDateTime(rd.redeemedAt)}
                      {rd.valueCents > 0 ? ` · cost ${formatMoney(rd.valueCents)}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-brand-700">
                    −{rd.pointsSpent} pts
                  </p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Recent visits */}
        <Card>
          <CardHeader title="Recent visits" description="Last 10 visits" />
          <CardBody className="px-0 py-0">
            {customer.visits.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-faint">
                No visits logged yet.
              </p>
            ) : (
              <ul className="divide-y divide-ink/5">
                {customer.visits.map((visit) => (
                  <li
                    key={visit.id}
                    className="flex items-start justify-between gap-4 px-5 py-3 transition-colors hover:bg-paper-deep/50"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs text-ink-soft"
                      >
                        ☕
                      </span>
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {formatDateTime(visit.visitedAt)}
                        </p>
                        {visit.note ? (
                          <p className="mt-0.5 text-sm text-ink-soft">
                            {visit.note}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-ink">
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
              <p className="px-5 py-6 text-sm text-ink-faint">
                No feedback yet.
              </p>
            ) : (
              <ul className="divide-y divide-ink/5">
                {customer.reviews.map((review) => (
                  <li key={review.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <StarRating rating={review.rating} />
                      <p className="text-xs text-ink-faint">
                        {formatDate(review.createdAt)}
                      </p>
                    </div>
                    {review.comment ? (
                      <p className="mt-1 text-sm text-ink-soft">
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
              <span className="text-ink-faint">Phone</span>
              <span className="text-ink">{customer.phone ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-ink-faint">Email</span>
              <span className="text-ink">{customer.email ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-ink-faint">Birthday</span>
              <span className="text-ink">
                {formatDateOnly(customer.birthday)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-ink-faint">Marketing</span>
              {customer.marketingConsent ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-moss">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-moss" />
                  Consent given
                </span>
              ) : (
                <span className="text-ink-faint">No marketing consent</span>
              )}
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-ink-faint">Source</span>
              <Badge>{customer.source}</Badge>
            </div>
          </CardBody>
        </Card>

        {/* Notes */}
        {customer.notes ? (
          <Card>
            <CardHeader title="Notes" />
            <CardBody>
              <p className="whitespace-pre-wrap text-sm text-ink-soft">
                {customer.notes}
              </p>
            </CardBody>
          </Card>
        ) : null}
      </div>

      {/* Danger zone — owner only. Staff and managers can add and edit guests
          but never delete them. */}
      {isOwner ? (
        <Card className="mt-6 border-red-200">
          <CardHeader
            title="Danger zone"
            description="Deleting a guest permanently removes their visits and feedback."
          />
          <CardBody>
            <DeleteCustomerButton customerId={customer.id} customerName={name} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
