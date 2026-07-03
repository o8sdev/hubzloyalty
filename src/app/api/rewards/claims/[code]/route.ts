import { db } from "@/lib/db";
import { json, notFound, requireApiSession } from "@/lib/http";
import { formatRewardCode, normalizeRewardCode } from "@/lib/onetime";

/**
 * Staff lookup before redeeming: shows what the code is worth and who it
 * belongs to. Business-scoped — a code from another tenant is a 404.
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
  if (normalized.length !== 6) {
    return notFound("No reward found for that code");
  }

  const claim = await db.rewardClaim.findFirst({
    where: { code: normalized, businessId },
    select: {
      code: true,
      rewardText: true,
      status: true,
      expiresAt: true,
      redeemedAt: true,
      createdAt: true,
      customer: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!claim) return notFound("No reward found for that code");

  const expired =
    claim.status === "PENDING" &&
    claim.expiresAt !== null &&
    claim.expiresAt < new Date();

  return json({
    code: formatRewardCode(claim.code),
    rewardText: claim.rewardText,
    status: expired ? "EXPIRED" : claim.status,
    expiresAt: claim.expiresAt,
    redeemedAt: claim.redeemedAt,
    grantedAt: claim.createdAt,
    customer: claim.customer,
  });
}
