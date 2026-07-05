import { db } from "@/lib/db";
import { json, notFound, requireApiSession } from "@/lib/http";
import { formatRewardCode, normalizeRewardCode } from "@/lib/onetime";

/**
 * Unified counter lookup: staff type/scan ANY guest code — welcome gift,
 * check-in, or a self-redeem reward code — and see what it is before
 * confirming. Business-scoped; a code from another tenant is a 404.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const { businessId } = auth.session;

  const { code } = await params;
  const normalized = normalizeRewardCode(code);
  if (normalized.length !== 6) return notFound("No code found");

  const now = new Date();

  const claim = await db.rewardClaim.findFirst({
    where: { code: normalized, businessId },
    select: {
      code: true,
      rewardText: true,
      status: true,
      expiresAt: true,
      redeemedAt: true,
      customer: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (claim) {
    const expired =
      claim.status === "PENDING" && claim.expiresAt !== null && claim.expiresAt < now;
    return json({
      kind: "GIFT",
      code: formatRewardCode(claim.code),
      rewardText: claim.rewardText,
      status: expired ? "EXPIRED" : claim.status,
      expiresAt: claim.expiresAt,
      redeemedAt: claim.redeemedAt,
      customer: claim.customer,
    });
  }

  const checkin = await db.checkin.findFirst({
    where: { code: normalized, businessId },
    select: {
      code: true,
      status: true,
      tableNumber: true,
      expiresAt: true,
      confirmedAt: true,
      createdAt: true,
      customer: {
        select: { id: true, firstName: true, lastName: true, totalVisits: true },
      },
    },
  });
  if (checkin) {
    const expired = checkin.status === "PENDING" && checkin.expiresAt < now;
    return json({
      kind: "CHECKIN",
      code: formatRewardCode(checkin.code),
      status: expired ? "EXPIRED" : checkin.status,
      tableNumber: checkin.tableNumber,
      expiresAt: checkin.expiresAt,
      confirmedAt: checkin.confirmedAt,
      createdAt: checkin.createdAt,
      customer: checkin.customer,
    });
  }

  // Guest self-redeem reward code: PENDING until staff confirm it here, which
  // is when the points are actually spent.
  const redemption = await db.redemption.findFirst({
    where: { code: normalized, businessId },
    select: {
      code: true,
      status: true,
      rewardName: true,
      pointsSpent: true,
      expiresAt: true,
      redeemedAt: true,
      customer: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (redemption && redemption.code) {
    const expired =
      redemption.status === "PENDING" &&
      redemption.expiresAt !== null &&
      redemption.expiresAt < now;
    return json({
      kind: "REDEMPTION",
      code: formatRewardCode(redemption.code),
      status: expired ? "EXPIRED" : redemption.status,
      rewardName: redemption.rewardName,
      pointsSpent: redemption.pointsSpent,
      expiresAt: redemption.expiresAt,
      redeemedAt: redemption.redeemedAt,
      customer: redemption.customer,
    });
  }

  return notFound("No code found");
}
