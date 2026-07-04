import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// The loyalty points ledger (see prisma/schema.prisma → PointsLedger).
//
// The ledger is the SOURCE OF TRUTH for a guest's points; Customer.loyaltyPoints
// is a cache that must always equal SUM(delta) for that customer. Every points
// movement is appended here in the SAME transaction that moves the cache, so
// the two never drift. Rows are never edited or deleted — corrections are new
// REVERSAL rows. `valueCents` freezes the cash value of the movement (e.g. the
// cost of a reward handed over) so accounting reports survive later edits.
// ---------------------------------------------------------------------------

export const LEDGER_TYPES = [
  "EARN",
  "REDEEM",
  "WELCOME_BONUS",
  "BIRTHDAY_BONUS",
  "TIER_BONUS",
  "EXPIRE",
  "MANUAL_ADJUST",
  "REVERSAL",
] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];

export const LEDGER_SOURCES = [
  "VISIT",
  "REDEMPTION",
  "REWARD_CLAIM",
  "CHECKIN",
  "CAMPAIGN",
  "MANUAL",
] as const;
export type LedgerSource = (typeof LEDGER_SOURCES)[number];

type LedgerBase = {
  businessId: string;
  customerId: string;
  type: LedgerType;
  valueCents?: number;
  sourceType?: LedgerSource;
  sourceId?: string | null;
  createdByUserId?: string | null;
  note?: string | null;
};

/**
 * Append a ledger row when the caller has ALREADY moved the cached balance and
 * knows the resulting value (e.g. creditVisit's `UPDATE ... RETURNING`). This
 * does NOT touch Customer.loyaltyPoints — the caller owns that write.
 */
export async function recordLedgerRow(
  tx: Prisma.TransactionClient,
  entry: LedgerBase & { delta: number; balanceAfter: number }
): Promise<void> {
  await tx.pointsLedger.create({
    data: {
      businessId: entry.businessId,
      customerId: entry.customerId,
      type: entry.type,
      delta: entry.delta,
      balanceAfter: entry.balanceAfter,
      valueCents: entry.valueCents ?? 0,
      sourceType: entry.sourceType ?? null,
      sourceId: entry.sourceId ?? null,
      createdByUserId: entry.createdByUserId ?? null,
      note: entry.note ?? null,
    },
  });
}

/**
 * Move a customer's points by `delta` AND append the ledger row atomically,
 * keeping the cache equal to SUM(delta). Use for movements that don't already
 * touch the balance elsewhere: redemptions (delta < 0), item-gift value rows
 * (delta 0), manual adjustments, expiry. Returns the new balance.
 */
export async function postLedgerEntry(
  tx: Prisma.TransactionClient,
  entry: LedgerBase & { delta: number }
): Promise<number> {
  const updated = await tx.customer.update({
    where: { id: entry.customerId },
    data: { loyaltyPoints: { increment: entry.delta } },
    select: { loyaltyPoints: true },
  });
  await recordLedgerRow(tx, { ...entry, balanceAfter: updated.loyaltyPoints });
  return updated.loyaltyPoints;
}

/**
 * Integrity check (dev / admin): the cached balance must equal the ledger sum.
 * Returns { ok } — a drift means a movement bypassed the ledger.
 */
export async function reconcileCustomer(
  customerId: string
): Promise<{ cached: number; ledgerSum: number; ok: boolean }> {
  const [cust, agg] = await Promise.all([
    db.customer.findUnique({
      where: { id: customerId },
      select: { loyaltyPoints: true },
    }),
    db.pointsLedger.aggregate({
      where: { customerId },
      _sum: { delta: true },
    }),
  ]);
  const cached = cust?.loyaltyPoints ?? 0;
  const ledgerSum = agg._sum.delta ?? 0;
  return { cached, ledgerSum, ok: cached === ledgerSum };
}
