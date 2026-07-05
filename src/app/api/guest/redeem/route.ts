import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  badRequest,
  forbidden,
  json,
  notFound,
  parseBody,
  requireApiGuestSession,
  serverError,
} from "@/lib/http";
import { redeemCancelSchema, redemptionCreateSchema } from "@/lib/validation";
import { generateUniqueBearerCode, REDEMPTION_CODE_TTL_MS } from "@/lib/checkins";
import { formatRewardCode, normalizeRewardCode } from "@/lib/onetime";

/** Thrown when the guest already holds a live PENDING code (one at a time). */
class HasPendingCode extends Error {
  constructor(public existingCode: string) {
    super("You already have a reward code waiting");
  }
}

/**
 * Guest SELF-redeem — the consumer half of the redemption loop. A signed-in
 * guest mints a bearer code from their wallet for a reward they can afford.
 *
 * IMPORTANT: minting does NOT move points. It only records a PENDING intent
 * (mirrors the welcome-gift claim). The points are actually spent when STAFF
 * confirm the code at the counter (POST /api/counter/codes/[code]/confirm),
 * where a compare-and-set decrement is the authoritative overspend guard. So a
 * guest can mint a code but only ever confirm up to their real balance.
 *
 * At most one live PENDING code per membership (partial unique index); stale
 * (time-expired) codes are swept to EXPIRED here so a new one can be minted.
 */
export async function POST(req: Request) {
  const auth = await requireApiGuestSession();
  if (auth.error) return auth.error;
  const { guestId } = auth.guest;

  const parsed = await parseBody(req, redemptionCreateSchema);
  if (parsed.error) return parsed.error;
  const { rewardId } = parsed.data;

  try {
    const reward = await db.reward.findUnique({
      where: { id: rewardId },
      select: {
        id: true,
        businessId: true,
        name: true,
        pointsCost: true,
        costValueCents: true,
        active: true,
        business: { select: { suspendedAt: true } },
      },
    });
    if (!reward) return notFound("That reward isn't available");
    if (reward.business.suspendedAt) return forbidden();
    if (!reward.active) return badRequest("That reward isn't available anymore");

    // Tenancy: the guest can only redeem where they hold a membership. This
    // scopes everything to reward.businessId — an arbitrary rewardId from a
    // business the guest hasn't joined resolves to no customer.
    const customer = await db.customer.findUnique({
      where: {
        businessId_guestId: { businessId: reward.businessId, guestId },
      },
      select: { id: true, loyaltyPoints: true },
    });
    if (!customer) {
      return badRequest("Check in here first to start earning points");
    }
    if (customer.loyaltyPoints < reward.pointsCost) {
      return badRequest("You don't have enough points for that reward yet");
    }

    const now = new Date();
    const code = await generateUniqueBearerCode();

    try {
      const created = await db.$transaction(async (tx) => {
        // Sweep the guest's own stale (time-expired) PENDING code so it stops
        // occupying the one-live-code slot; expiry is derived, not cron'd.
        await tx.redemption.updateMany({
          where: {
            customerId: customer.id,
            status: "PENDING",
            expiresAt: { lt: now },
          },
          data: { status: "EXPIRED" },
        });

        const existing = await tx.redemption.findFirst({
          where: { customerId: customer.id, status: "PENDING" },
          select: { code: true },
        });
        if (existing?.code) throw new HasPendingCode(existing.code);

        // No points move here — that happens at counter confirmation. Freeze
        // the reward's name / cost / value onto the row for accounting.
        return tx.redemption.create({
          data: {
            businessId: reward.businessId,
            customerId: customer.id,
            rewardId: reward.id,
            rewardName: reward.name,
            pointsSpent: reward.pointsCost,
            valueCents: reward.costValueCents,
            code,
            status: "PENDING",
            expiresAt: new Date(now.getTime() + REDEMPTION_CODE_TTL_MS),
          },
          select: { code: true, expiresAt: true },
        });
      });

      return json({
        ok: true,
        code: formatRewardCode(created.code!),
        rewardName: reward.name,
        pointsCost: reward.pointsCost,
        expiresAt: created.expiresAt,
      });
    } catch (err) {
      // Lost the race on the one-PENDING-per-customer partial unique index.
      if (
        err instanceof HasPendingCode ||
        (err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002")
      ) {
        const existingCode =
          err instanceof HasPendingCode
            ? formatRewardCode(err.existingCode)
            : null;
        return json(
          {
            error:
              "You already have a reward code waiting — scan it at the counter or cancel it first",
            code: existingCode,
          },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (err) {
    console.error("guest redeem mint failed", err);
    return serverError("Could not create your reward code — please try again");
  }
}

/** Guest cancels their own PENDING code (frees the slot to pick another reward). */
export async function DELETE(req: Request) {
  const auth = await requireApiGuestSession();
  if (auth.error) return auth.error;
  const { guestId } = auth.guest;

  const parsed = await parseBody(req, redeemCancelSchema);
  if (parsed.error) return parsed.error;
  const normalized = normalizeRewardCode(parsed.data.code);

  try {
    // Tenancy: only the owning guest's own PENDING code (via the customer join).
    const redemption = await db.redemption.findFirst({
      where: { code: normalized, status: "PENDING", customer: { guestId } },
      select: { id: true },
    });
    if (!redemption) return notFound("No pending code to cancel");

    await db.redemption.updateMany({
      where: { id: redemption.id, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    return json({ ok: true });
  } catch (err) {
    console.error("guest redeem cancel failed", err);
    return serverError("Could not cancel the code — please try again");
  }
}
