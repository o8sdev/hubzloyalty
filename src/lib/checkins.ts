import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateRewardCode } from "@/lib/onetime";

// ---------------------------------------------------------------------------
// Staff-confirmed check-ins: the funnel mints a short-lived code; a human
// confirming that code is what creates the Visit and credits points. This
// file holds the shared pieces used by the funnel, the counter endpoints,
// and the pending queue.
// ---------------------------------------------------------------------------

export const CHECKIN_TTL_MS = 2 * 60 * 60 * 1000; // codes live 2 hours

/**
 * A code must be unique across BOTH bearer-code tables (welcome gifts and
 * check-ins) so the counter lookup is unambiguous.
 */
export async function generateUniqueCheckinCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRewardCode();
    const [claim, checkin] = await Promise.all([
      db.rewardClaim.findUnique({ where: { code }, select: { id: true } }),
      db.checkin.findUnique({ where: { code }, select: { id: true } }),
    ]);
    if (!claim && !checkin) return code;
  }
  throw new Error("could not generate a unique check-in code");
}

export type LoyaltyNumbers = {
  pointsPerVisit: number;
  silverThreshold: number;
  goldThreshold: number;
  vipThreshold: number;
};

/**
 * Credit one confirmed visit inside an open transaction: Visit row + a
 * single-statement points/tier update (round trips are the budget on a
 * remote DB).
 */
export async function creditVisit(
  tx: Prisma.TransactionClient,
  opts: {
    businessId: string;
    customerId: string;
    loyalty: LoyaltyNumbers;
    note?: string;
  }
): Promise<void> {
  await tx.visit.create({
    data: {
      businessId: opts.businessId,
      customerId: opts.customerId,
      amountCents: 0,
      pointsEarned: opts.loyalty.pointsPerVisit,
      note: opts.note ?? "QR check-in",
    },
  });
  await tx.$executeRaw`
    UPDATE "Customer" SET
      "totalVisits"  = "totalVisits" + 1,
      "loyaltyPoints" = "loyaltyPoints" + ${opts.loyalty.pointsPerVisit},
      "lastVisitAt"  = now(),
      "updatedAt"    = now(),
      "tier" = CASE
        WHEN "totalVisits" + 1 >= ${opts.loyalty.vipThreshold} THEN 'VIP'
        WHEN "totalVisits" + 1 >= ${opts.loyalty.goldThreshold} THEN 'GOLD'
        WHEN "totalVisits" + 1 >= ${opts.loyalty.silverThreshold} THEN 'SILVER'
        ELSE 'BRONZE'
      END
    WHERE id = ${opts.customerId}`;
}

/**
 * Can this customer mint a new earning check-in right now, per the
 * business's policy? Returns the blocking reason or "ok" — plus any still
 * PENDING unexpired check-in so the funnel can re-show the same code
 * instead of minting duplicates.
 */
export async function checkEarnEligibility(opts: {
  businessId: string;
  customerId: string;
  earnCooldownHours: number;
  maxEarnPerDay: number;
}): Promise<
  | { state: "reuse"; checkin: { code: string; expiresAt: Date; tableNumber: string | null } }
  | { state: "cooldown" }
  | { state: "capped" }
  | { state: "ok" }
> {
  const now = new Date();

  const pending = await db.checkin.findFirst({
    where: {
      businessId: opts.businessId,
      customerId: opts.customerId,
      status: "PENDING",
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
    select: { code: true, expiresAt: true, tableNumber: true },
  });
  if (pending) return { state: "reuse", checkin: pending };

  if (opts.earnCooldownHours > 0) {
    const cooldownStart = new Date(
      now.getTime() - opts.earnCooldownHours * 60 * 60 * 1000
    );
    const recentConfirmed = await db.checkin.findFirst({
      where: {
        businessId: opts.businessId,
        customerId: opts.customerId,
        status: "CONFIRMED",
        confirmedAt: { gte: cooldownStart },
      },
      select: { id: true },
    });
    if (recentConfirmed) return { state: "cooldown" };
  }

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const todayCount = await db.checkin.count({
    where: {
      businessId: opts.businessId,
      customerId: opts.customerId,
      OR: [
        { status: "CONFIRMED", confirmedAt: { gte: dayStart } },
        { status: "PENDING", createdAt: { gte: dayStart }, expiresAt: { gt: now } },
      ],
    },
  });
  if (todayCount >= opts.maxEarnPerDay) return { state: "capped" };

  return { state: "ok" };
}
