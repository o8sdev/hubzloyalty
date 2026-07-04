import { PrismaClient } from "@prisma/client";

// One-off, idempotent: make every customer's cached loyaltyPoints reconcile
// with the PointsLedger. Two passes per customer:
//   1. If they have no ledger rows yet, replay their Visits as EARN entries
//      (historical granularity).
//   2. If the ledger sum still != the cached balance (e.g. seeded points with
//      no visits behind them), post one opening-balance MANUAL_ADJUST for the
//      difference — the standard treatment when introducing a ledger over
//      pre-existing balances.
// Safe to run more than once: reconciled customers are skipped.
// Run: npx tsx scripts/backfill-ledger.ts
const db = new PrismaClient();

async function ledgerSum(customerId: string): Promise<number> {
  const agg = await db.pointsLedger.aggregate({
    where: { customerId },
    _sum: { delta: true },
  });
  return agg._sum.delta ?? 0;
}

async function main() {
  const customers = await db.customer.findMany({
    select: { id: true, businessId: true, loyaltyPoints: true },
  });

  let earnRows = 0;
  let openingRows = 0;
  let reconciled = 0;

  for (const c of customers) {
    // Pass 1 — replay visits as EARN rows, only if this customer has none yet.
    if ((await db.pointsLedger.count({ where: { customerId: c.id } })) === 0) {
      const visits = await db.visit.findMany({
        where: { customerId: c.id },
        orderBy: { visitedAt: "asc" },
        select: { id: true, businessId: true, pointsEarned: true, visitedAt: true },
      });
      let running = 0;
      for (const v of visits) {
        running += v.pointsEarned;
        await db.pointsLedger.create({
          data: {
            businessId: v.businessId,
            customerId: c.id,
            type: "EARN",
            delta: v.pointsEarned,
            balanceAfter: running,
            sourceType: "VISIT",
            sourceId: v.id,
            note: "Backfilled from existing visit",
            createdAt: v.visitedAt,
          },
        });
        earnRows++;
      }
    }

    // Pass 2 — true up any remaining difference with an opening balance.
    const sum = await ledgerSum(c.id);
    if (sum !== c.loyaltyPoints) {
      await db.pointsLedger.create({
        data: {
          businessId: c.businessId,
          customerId: c.id,
          type: "MANUAL_ADJUST",
          delta: c.loyaltyPoints - sum,
          balanceAfter: c.loyaltyPoints,
          note: "Opening balance — reconciled at ledger introduction",
          sourceType: "MANUAL",
        },
      });
      openingRows++;
    } else {
      reconciled++;
    }
  }

  console.log(
    `Backfill done. EARN rows: ${earnRows}, opening-balance adjustments: ${openingRows}, already reconciled: ${reconciled}`
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
