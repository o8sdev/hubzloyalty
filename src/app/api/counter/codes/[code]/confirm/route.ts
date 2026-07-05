import { after } from "next/server";
import { db } from "@/lib/db";
import {
  badRequest,
  json,
  notFound,
  requireApiSession,
  serverError,
} from "@/lib/http";
import { normalizeRewardCode } from "@/lib/onetime";
import { creditVisit } from "@/lib/checkins";
import { postLedgerEntry, recordLedgerRow } from "@/lib/ledger";
import { actorFromSession, recordAudit } from "@/lib/audit";

/** Best-effort "First Last" for a customer, for the audit summary. */
async function customerName(customerId: string): Promise<string> {
  const c = await db.customer.findUnique({
    where: { id: customerId },
    select: { firstName: true, lastName: true },
  });
  return c ? [c.firstName, c.lastName].filter(Boolean).join(" ") : "a guest";
}

/**
 * Unified counter confirmation. One human tap does the right thing for
 * whatever code the guest showed:
 *
 * - CHECK-IN code → atomically CONFIRM it and credit the visit + points.
 * - GIFT code (welcome reward) → atomically redeem it AND confirm the
 *   guest's pending check-in from the same funnel completion (first visits
 *   show only the gift code — one code, one tap, both effects).
 * - REDEMPTION code (guest self-redeem) → atomically spend the points: the
 *   guest minted it in their wallet; confirming here is when points actually
 *   move (compare-and-set decrement + REDEEM ledger row).
 *
 * Any business member (owner, admin, staff) may confirm; every confirmation
 * records who did it.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const { businessId, userId } = auth.session;
  const actor = actorFromSession(auth.session);

  const { code } = await params;
  const normalized = normalizeRewardCode(code);
  if (normalized.length !== 6) return notFound("No code found");

  try {
    const loyalty = await db.business.findUnique({
      where: { id: businessId },
      select: {
        pointsPerVisit: true,
        silverThreshold: true,
        goldThreshold: true,
        vipThreshold: true,
      },
    });
    if (!loyalty) return notFound("Business not found");

    const now = new Date();

    // ---- Gift code path -----------------------------------------------
    const claim = await db.rewardClaim.findFirst({
      where: { code: normalized, businessId },
      select: {
        id: true,
        customerId: true,
        status: true,
        expiresAt: true,
        valueCents: true,
      },
    });
    if (claim) {
      if (claim.status === "REDEEMED") return badRequest("Already redeemed");
      if (claim.expiresAt && claim.expiresAt < now) {
        return badRequest("This code has expired");
      }

      let visitCredited = false;
      await db.$transaction(
        async (tx) => {
          const redeemed = await tx.rewardClaim.updateMany({
            where: { id: claim.id, status: "PENDING" },
            data: {
              status: "REDEEMED",
              redeemedAt: now,
              redeemedByUserId: userId,
            },
          });
          if (redeemed.count !== 1) throw new AlreadyHandled("Already redeemed");

          // Record the gift hand-over on the ledger (delta 0 — it's a free
          // item, not points — with its frozen cost value for accounting).
          await postLedgerEntry(tx, {
            businessId,
            customerId: claim.customerId,
            type: "WELCOME_BONUS",
            delta: 0,
            valueCents: claim.valueCents,
            sourceType: "REWARD_CLAIM",
            sourceId: claim.id,
            createdByUserId: userId,
            note: "Welcome gift handed over",
          });

          // First-visit ride-along: confirm the pending check-in minted by
          // the same funnel completion, if one is still open.
          const pending = await tx.checkin.findFirst({
            where: {
              businessId,
              customerId: claim.customerId,
              status: "PENDING",
              expiresAt: { gt: now },
            },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          });
          if (pending) {
            const confirmed = await tx.checkin.updateMany({
              where: { id: pending.id, status: "PENDING" },
              data: {
                status: "CONFIRMED",
                confirmedAt: now,
                confirmedByUserId: userId,
              },
            });
            if (confirmed.count === 1) {
              await creditVisit(tx, {
                businessId,
                customerId: claim.customerId,
                loyalty,
                earnedByUserId: userId,
              });
              visitCredited = true;
            }
          }
        },
        { maxWait: 10_000, timeout: 30_000 }
      );

      after(async () => {
        const name = await customerName(claim.customerId);
        await recordAudit({
          businessId,
          actor,
          action: "gift.redeem",
          summary: `Handed over welcome gift for ${name}${visitCredited ? " · visit + points credited" : ""}`,
          targetType: "customer",
          targetId: claim.customerId,
        });
      });
      return json({ ok: true, kind: "GIFT", visitCredited });
    }

    // ---- Redemption code path (guest self-redeem) -----------------------
    const redemption = await db.redemption.findFirst({
      where: { code: normalized, businessId },
      select: {
        id: true,
        customerId: true,
        status: true,
        expiresAt: true,
        pointsSpent: true,
        valueCents: true,
        rewardName: true,
      },
    });
    if (redemption) {
      if (redemption.status === "CONFIRMED") return badRequest("Already redeemed");
      if (redemption.status !== "PENDING") {
        return badRequest("This code is no longer valid");
      }
      if (redemption.expiresAt && redemption.expiresAt < now) {
        return badRequest("This code has expired");
      }

      await db.$transaction(
        async (tx) => {
          // One-time-use guard first (cheap): flip PENDING → CONFIRMED. A
          // concurrent confirm on the same code loses the race here.
          const claimed = await tx.redemption.updateMany({
            where: { id: redemption.id, status: "PENDING" },
            data: {
              status: "CONFIRMED",
              redeemedAt: now,
              redeemedByUserId: userId,
            },
          });
          if (claimed.count !== 1) throw new AlreadyHandled("Already redeemed");

          // Overspend guard: the balance may have dropped since the guest
          // minted the code, so this compare-and-set is authoritative. A
          // failure rolls back the status flip above — the code stays PENDING.
          const debited = await tx.customer.updateMany({
            where: {
              id: redemption.customerId,
              loyaltyPoints: { gte: redemption.pointsSpent },
            },
            data: { loyaltyPoints: { decrement: redemption.pointsSpent } },
          });
          if (debited.count !== 1) throw new InsufficientPoints();

          const updated = await tx.customer.findUnique({
            where: { id: redemption.customerId },
            select: { loyaltyPoints: true },
          });
          const balanceAfter = updated?.loyaltyPoints ?? 0;

          await recordLedgerRow(tx, {
            businessId,
            customerId: redemption.customerId,
            type: "REDEEM",
            delta: -redemption.pointsSpent,
            balanceAfter,
            valueCents: redemption.valueCents,
            sourceType: "REDEMPTION",
            sourceId: redemption.id,
            createdByUserId: userId,
            note: `Redeemed: ${redemption.rewardName}`,
          });
        },
        { maxWait: 10_000, timeout: 30_000 }
      );

      after(async () => {
        const name = await customerName(redemption.customerId);
        await recordAudit({
          businessId,
          actor,
          action: "redemption.confirm",
          summary: `Redeemed "${redemption.rewardName}" (${redemption.pointsSpent} pts) for ${name}`,
          targetType: "customer",
          targetId: redemption.customerId,
        });
      });
      return json({
        ok: true,
        kind: "REDEMPTION",
        rewardName: redemption.rewardName,
        pointsSpent: redemption.pointsSpent,
      });
    }

    // ---- Check-in code path ---------------------------------------------
    const checkin = await db.checkin.findFirst({
      where: { code: normalized, businessId },
      select: { id: true, customerId: true, status: true, expiresAt: true },
    });
    if (!checkin) return notFound("No code found");
    if (checkin.status === "CONFIRMED") return badRequest("Already confirmed");
    if (checkin.expiresAt < now) return badRequest("This code has expired");

    await db.$transaction(
      async (tx) => {
        const confirmed = await tx.checkin.updateMany({
          where: { id: checkin.id, status: "PENDING", expiresAt: { gt: now } },
          data: {
            status: "CONFIRMED",
            confirmedAt: now,
            confirmedByUserId: userId,
          },
        });
        if (confirmed.count !== 1) throw new AlreadyHandled("Already confirmed");
        await creditVisit(tx, {
          businessId,
          customerId: checkin.customerId,
          loyalty,
          earnedByUserId: userId,
        });
      },
      { maxWait: 10_000, timeout: 30_000 }
    );

    after(async () => {
      const name = await customerName(checkin.customerId);
      await recordAudit({
        businessId,
        actor,
        action: "checkin.confirm",
        summary: `Confirmed check-in for ${name} · visit + points credited`,
        targetType: "customer",
        targetId: checkin.customerId,
      });
    });
    return json({ ok: true, kind: "CHECKIN", visitCredited: true });
  } catch (err) {
    if (err instanceof AlreadyHandled) return badRequest(err.message);
    if (err instanceof InsufficientPoints) {
      return badRequest("The guest no longer has enough points for this reward");
    }
    console.error("counter confirm failed", err);
    return serverError("Could not confirm this code");
  }
}

/** Thrown inside transactions to surface a 400 (and roll back cleanly). */
class AlreadyHandled extends Error {}
/** The guest's balance dropped below the code's cost since it was minted. */
class InsufficientPoints extends Error {}
