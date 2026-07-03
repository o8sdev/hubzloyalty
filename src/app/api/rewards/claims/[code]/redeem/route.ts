import { db } from "@/lib/db";
import { badRequest, json, notFound, requireApiSession, serverError } from "@/lib/http";
import { normalizeRewardCode } from "@/lib/onetime";

/**
 * Marks a claim REDEEMED. Atomic compare-and-set (status must still be
 * PENDING and unexpired), so double-taps and two tills racing can redeem a
 * code exactly once. Records who confirmed it.
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
  if (normalized.length !== 6) {
    return notFound("No reward found for that code");
  }

  try {
    const now = new Date();
    const redeemed = await db.rewardClaim.updateMany({
      where: {
        code: normalized,
        businessId,
        status: "PENDING",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: { status: "REDEEMED", redeemedAt: now, redeemedByUserId: userId },
    });

    if (redeemed.count === 1) return json({ ok: true });

    // Explain exactly why it didn't redeem.
    const claim = await db.rewardClaim.findFirst({
      where: { code: normalized, businessId },
      select: { status: true, expiresAt: true, redeemedAt: true },
    });
    if (!claim) return notFound("No reward found for that code");
    if (claim.status === "REDEEMED") {
      return badRequest("Already redeemed");
    }
    if (claim.expiresAt && claim.expiresAt < now) {
      return badRequest("This code has expired");
    }
    return badRequest("Could not redeem this code");
  } catch (err) {
    console.error("claim redeem failed", err);
    return serverError("Could not redeem this code");
  }
}
