import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { formatDateTime, formatMoney } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  EARN: "Earned",
  REDEEM: "Redeemed",
  WELCOME_BONUS: "Welcome gift",
  BIRTHDAY_BONUS: "Birthday bonus",
  TIER_BONUS: "Tier bonus",
  EXPIRE: "Expired",
  MANUAL_ADJUST: "Adjustment",
  REVERSAL: "Reversal",
};

export default async function LoyaltyPage() {
  const session = await requireSession();
  const businessId = session.businessId;

  const [
    outstanding,
    issued,
    redeemed,
    expired,
    valueGiven,
    membersWithPoints,
    redemptionCount,
    entries,
  ] = await Promise.all([
    db.customer.aggregate({
      where: { businessId },
      _sum: { loyaltyPoints: true },
    }),
    db.pointsLedger.aggregate({
      where: { businessId, delta: { gt: 0 } },
      _sum: { delta: true },
    }),
    db.pointsLedger.aggregate({
      where: { businessId, type: "REDEEM" },
      _sum: { delta: true },
    }),
    db.pointsLedger.aggregate({
      where: { businessId, type: "EXPIRE" },
      _sum: { delta: true },
    }),
    db.pointsLedger.aggregate({
      where: { businessId, valueCents: { gt: 0 } },
      _sum: { valueCents: true },
    }),
    db.customer.count({ where: { businessId, loyaltyPoints: { gt: 0 } } }),
    db.redemption.count({ where: { businessId, status: "CONFIRMED" } }),
    db.pointsLedger.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  const outstandingPts = outstanding._sum.loyaltyPoints ?? 0;
  const issuedPts = issued._sum.delta ?? 0;
  const redeemedPts = Math.abs(redeemed._sum.delta ?? 0);
  const expiredPts = Math.abs(expired._sum.delta ?? 0);
  const valueGivenCents = valueGiven._sum.valueCents ?? 0;

  return (
    <div>
      <PageHeader
        title="Loyalty"
        description="Your points economy at a glance. Every figure comes from the append-only ledger, so it reconciles to the cent."
        action={
          <LinkButton
            variant="secondary"
            href="/api/business/ledger/export"
            prefetch={false}
          >
            Export ledger (CSV)
          </LinkButton>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Points outstanding"
          value={outstandingPts.toLocaleString()}
          hint="Your current liability"
        />
        <StatCard
          label="Value given away"
          value={formatMoney(valueGivenCents)}
          hint="Welcome gifts + rewards handed over"
        />
        <StatCard
          label="Points issued"
          value={issuedPts.toLocaleString()}
          hint="All-time earned + bonuses"
        />
        <StatCard
          label="Points redeemed"
          value={redeemedPts.toLocaleString()}
          hint={`${redemptionCount} redemption${redemptionCount === 1 ? "" : "s"}`}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Members with points"
          value={membersWithPoints.toLocaleString()}
        />
        <StatCard label="Points expired" value={expiredPts.toLocaleString()} />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Recent ledger activity"
          description="Every points movement, newest first"
        />
        <CardBody className="px-0 py-0">
          {entries.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No points activity yet"
                description="Points appear here as guests check in and redeem rewards."
              />
            </div>
          ) : (
            <ul className="divide-y divide-ink/5">
              {entries.map((e) => {
                const name = e.customer
                  ? [e.customer.firstName, e.customer.lastName]
                      .filter(Boolean)
                      .join(" ")
                  : "a guest";
                const positive = e.delta > 0;
                return (
                  <li
                    key={e.id}
                    className="flex items-start justify-between gap-4 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {TYPE_LABEL[e.type] ?? e.type}
                        <span className="font-normal text-ink-faint">
                          {" · "}
                          {name}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {formatDateTime(e.createdAt)}
                        {e.valueCents > 0 ? ` · ${formatMoney(e.valueCents)}` : ""}
                        {e.note ? ` · ${e.note}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={
                          positive
                            ? "text-sm font-semibold text-ink"
                            : e.delta < 0
                              ? "text-sm font-semibold text-brand-700"
                              : "text-sm font-semibold text-ink-faint"
                        }
                      >
                        {positive ? "+" : ""}
                        {e.delta} pts
                      </p>
                      <p className="text-[11px] text-ink-faint">
                        bal {e.balanceAfter}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
