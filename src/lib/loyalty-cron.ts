import { db } from "@/lib/db";
import { postLedgerEntry, recordLedgerRow } from "@/lib/ledger";

// ---------------------------------------------------------------------------
// Daily loyalty batch jobs, run by /api/cron/loyalty (Vercel cron). Each is
// idempotent so a re-run — or a twice-in-one-day invocation — is safe. Every
// movement posts to PointsLedger in the same transaction that moves the cache,
// keeping Customer.loyaltyPoints == SUM(delta).
// ---------------------------------------------------------------------------

type BirthdayRow = {
  customerId: string;
  businessId: string;
  points: number;
};
type ExpiryRow = { customerId: string; businessId: string };

function startOfYearUTC(): Date {
  return new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
}

/**
 * Award birthday bonuses to every guest whose birthday is today, at most once
 * per calendar year. The NOT EXISTS guard (and the in-transaction re-check)
 * skip anyone already given a BIRTHDAY_BONUS since Jan 1, so re-runs are no-ops.
 */
export async function runBirthdayBonuses(): Promise<{
  awarded: number;
  points: number;
}> {
  // ONE year boundary (DB time), bound into BOTH the eligibility filter and the
  // per-row re-check so they can never disagree — not even for a cron invocation
  // that straddles midnight on Jan 1 in a non-UTC database session.
  const yearStartRows = await db.$queryRaw<{ yearStart: Date }[]>`
    SELECT date_trunc('year', now()) AS "yearStart"`;
  const since = yearStartRows[0]?.yearStart ?? startOfYearUTC();

  const rows = await db.$queryRaw<BirthdayRow[]>`
    SELECT c.id AS "customerId", c."businessId", b."birthdayBonusPoints" AS points
    FROM "Customer" c
    JOIN "Business" b ON b.id = c."businessId"
    WHERE b."birthdayBonusEnabled" = true
      AND b."birthdayBonusPoints" > 0
      AND b."suspendedAt" IS NULL
      AND c.birthday IS NOT NULL
      AND EXTRACT(MONTH FROM c.birthday) = EXTRACT(MONTH FROM now())
      AND EXTRACT(DAY   FROM c.birthday) = EXTRACT(DAY   FROM now())
      AND NOT EXISTS (
        SELECT 1 FROM "PointsLedger" l
        WHERE l."customerId" = c.id
          AND l.type = 'BIRTHDAY_BONUS'
          AND l."createdAt" >= ${since}
      )`;

  let awarded = 0;
  let points = 0;

  for (const r of rows) {
    try {
      const did = await db.$transaction(async (tx) => {
        // Re-check inside the tx to stay idempotent under a concurrent run.
        const already = await tx.pointsLedger.findFirst({
          where: {
            customerId: r.customerId,
            type: "BIRTHDAY_BONUS",
            createdAt: { gte: since },
          },
          select: { id: true },
        });
        if (already) return false;
        await postLedgerEntry(tx, {
          businessId: r.businessId,
          customerId: r.customerId,
          type: "BIRTHDAY_BONUS",
          delta: r.points,
          sourceType: "SYSTEM",
          note: "Birthday bonus",
        });
        return true;
      });
      if (did) {
        awarded += 1;
        points += r.points;
      }
    } catch (err) {
      console.error("birthday bonus failed for", r.customerId, err);
    }
  }

  return { awarded, points };
}

/**
 * Expire the points of guests who've been inactive for the business's configured
 * window (months since last visit, falling back to signup). Zeroes the balance
 * with an EXPIRE ledger row. Idempotent: an expired balance is 0, so it no
 * longer matches; a compare-and-set guards the (rare) case of a balance change
 * between the read and the write.
 */
export async function runPointsExpiry(): Promise<{
  expired: number;
  points: number;
}> {
  const rows = await db.$queryRaw<ExpiryRow[]>`
    SELECT c.id AS "customerId", c."businessId"
    FROM "Customer" c
    JOIN "Business" b ON b.id = c."businessId"
    WHERE b."pointsExpiryMonths" > 0
      AND b."suspendedAt" IS NULL
      AND c."loyaltyPoints" > 0
      AND COALESCE(c."lastVisitAt", c."createdAt")
          < now() - (b."pointsExpiryMonths" || ' months')::interval`;

  let expired = 0;
  let points = 0;

  for (const r of rows) {
    try {
      const removed = await db.$transaction(async (tx) => {
        // Lock the row and RE-CHECK inactivity + read the true balance under
        // the lock. The eligibility SELECT above is a snapshot; if the guest
        // has earned/visited since (creditVisit set lastVisitAt=now()), they're
        // no longer inactive and must NOT be expired. Reading the balance here
        // (not from the snapshot) also keeps the ledger delta exact.
        const locked = await tx.$queryRaw<
          { loyaltyPoints: number; stillInactive: boolean }[]
        >`
          SELECT c."loyaltyPoints",
            ( b."pointsExpiryMonths" > 0
              AND COALESCE(c."lastVisitAt", c."createdAt")
                  < now() - (b."pointsExpiryMonths" || ' months')::interval
            ) AS "stillInactive"
          FROM "Customer" c
          JOIN "Business" b ON b.id = c."businessId"
          WHERE c.id = ${r.customerId}
          FOR UPDATE OF c`;
        const bal = locked[0]?.loyaltyPoints ?? 0;
        if (bal <= 0 || !locked[0]?.stillInactive) return 0;

        await tx.customer.update({
          where: { id: r.customerId },
          data: { loyaltyPoints: 0 },
        });

        await recordLedgerRow(tx, {
          businessId: r.businessId,
          customerId: r.customerId,
          type: "EXPIRE",
          delta: -bal,
          balanceAfter: 0,
          sourceType: "SYSTEM",
          note: "Points expired (inactivity)",
        });
        return bal;
      });
      if (removed > 0) {
        expired += 1;
        points += removed;
      }
    } catch (err) {
      console.error("points expiry failed for", r.customerId, err);
    }
  }

  return { expired, points };
}
