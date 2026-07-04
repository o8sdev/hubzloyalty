import { after } from "next/server";
import { db } from "@/lib/db";
import {
  badRequest,
  json,
  notFound,
  parseBody,
  requireApiSession,
  serverError,
} from "@/lib/http";
import { redemptionCreateSchema } from "@/lib/validation";
import { recordLedgerRow } from "@/lib/ledger";
import { actorFromSession, recordAudit } from "@/lib/audit";

/** Thrown inside the transaction when the guest can't afford the reward. */
class InsufficientPoints extends Error {}

/**
 * Staff redeems a reward for a guest — the points-SPEND half of the loyalty
 * loop. Any business member can redeem (it's a counter action). Atomic:
 * a compare-and-set decrement (loyaltyPoints >= cost) prevents overspend and
 * negative balances under concurrency, then a Redemption row (frozen name /
 * points / cost value) and a REDEEM ledger entry are written in the same tx.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const { businessId, userId } = auth.session;
  const { id: customerId } = await params;

  const parsed = await parseBody(req, redemptionCreateSchema);
  if (parsed.error) return parsed.error;
  const { rewardId } = parsed.data;

  try {
    // Both must belong to this business (tenancy).
    const [customer, reward] = await Promise.all([
      db.customer.findFirst({
        where: { id: customerId, businessId },
        select: { id: true, firstName: true, lastName: true },
      }),
      db.reward.findFirst({
        where: { id: rewardId, businessId },
        select: {
          id: true,
          name: true,
          pointsCost: true,
          costValueCents: true,
          active: true,
        },
      }),
    ]);
    if (!customer) return notFound("Customer not found");
    if (!reward) return notFound("Reward not found");
    if (!reward.active) return badRequest("That reward isn't available");

    const result = await db.$transaction(async (tx) => {
      // Compare-and-set: only decrement if the balance covers the cost. This
      // is the atomic overspend guard — count 0 means insufficient funds.
      const claimed = await tx.customer.updateMany({
        where: { id: customerId, loyaltyPoints: { gte: reward.pointsCost } },
        data: { loyaltyPoints: { decrement: reward.pointsCost } },
      });
      if (claimed.count !== 1) throw new InsufficientPoints();

      const updated = await tx.customer.findUnique({
        where: { id: customerId },
        select: { loyaltyPoints: true },
      });
      const balanceAfter = updated?.loyaltyPoints ?? 0;

      const redemption = await tx.redemption.create({
        data: {
          businessId,
          rewardId: reward.id,
          customerId,
          rewardName: reward.name, // frozen
          pointsSpent: reward.pointsCost, // frozen
          valueCents: reward.costValueCents, // frozen
          redeemedByUserId: userId,
        },
      });

      await recordLedgerRow(tx, {
        businessId,
        customerId,
        type: "REDEEM",
        delta: -reward.pointsCost,
        balanceAfter,
        valueCents: reward.costValueCents,
        sourceType: "REDEMPTION",
        sourceId: redemption.id,
        createdByUserId: userId,
        note: `Redeemed: ${reward.name}`,
      });

      return { redemption, balanceAfter };
    });

    after(() =>
      recordAudit({
        businessId,
        actor: actorFromSession(auth.session),
        action: "reward.redeem",
        summary: `Redeemed "${reward.name}" (${reward.pointsCost} pts) for ${[customer.firstName, customer.lastName].filter(Boolean).join(" ")}`,
        targetType: "customer",
        targetId: customerId,
      })
    );

    return json({
      ok: true,
      pointsSpent: reward.pointsCost,
      balanceAfter: result.balanceAfter,
    });
  } catch (err) {
    if (err instanceof InsufficientPoints) {
      return badRequest("Not enough points for that reward");
    }
    console.error("redemption failed", err);
    return serverError("Could not redeem the reward");
  }
}
