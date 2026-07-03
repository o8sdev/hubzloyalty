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

/**
 * Unified counter confirmation. One human tap does the right thing for
 * whatever code the guest showed:
 *
 * - CHECK-IN code → atomically CONFIRM it and credit the visit + points.
 * - GIFT code (welcome reward) → atomically redeem it AND confirm the
 *   guest's pending check-in from the same funnel completion (first visits
 *   show only the gift code — one code, one tap, both effects).
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
      select: { id: true, customerId: true, status: true, expiresAt: true },
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
              });
              visitCredited = true;
            }
          }
        },
        { maxWait: 10_000, timeout: 30_000 }
      );

      return json({ ok: true, kind: "GIFT", visitCredited });
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
        });
      },
      { maxWait: 10_000, timeout: 30_000 }
    );

    return json({ ok: true, kind: "CHECKIN", visitCredited: true });
  } catch (err) {
    if (err instanceof AlreadyHandled) return badRequest(err.message);
    console.error("counter confirm failed", err);
    return serverError("Could not confirm this code");
  }
}

/** Thrown inside transactions to surface a 400 (and roll back cleanly). */
class AlreadyHandled extends Error {}
