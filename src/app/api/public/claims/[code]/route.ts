import { db } from "@/lib/db";
import { json, notFound } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { normalizeRewardCode } from "@/lib/onetime";

/**
 * PUBLIC endpoint. Status of a reward claim by its bearer code — the code IS
 * the secret, so knowing it entitles you to its status and nothing more.
 * Used by the guest's device to stop re-showing redeemed/expired codes.
 * Returns no business or customer data.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const limited = await rateLimit({
    key: `pub:claim:${clientIp(req)}`,
    limit: 30,
    windowSeconds: 60 * 60,
  });
  if (limited) return limited;

  const { code } = await params;
  const normalized = normalizeRewardCode(code);
  if (normalized.length !== 6) return notFound("Unknown code");

  const claim = await db.rewardClaim.findUnique({
    where: { code: normalized },
    select: { status: true, expiresAt: true },
  });
  if (!claim) return notFound("Unknown code");

  const status =
    claim.status === "PENDING" && claim.expiresAt && claim.expiresAt < new Date()
      ? "EXPIRED"
      : claim.status;

  return json({ status });
}
