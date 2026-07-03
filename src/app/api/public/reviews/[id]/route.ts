import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { badRequest, json, notFound, parseBody, serverError } from "@/lib/http";
import { publicReviewDetailsSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { generateRewardCode } from "@/lib/onetime";

/**
 * PUBLIC endpoint — no auth. Steps two and three of the QR funnel: the guest
 * can attach a private comment, record that they clicked through to Google,
 * and optionally join the loyalty list (contact capture).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await rateLimit({
    key: `pub:detail:${clientIp(req)}`,
    limit: 60,
    windowSeconds: 60 * 60,
  });
  if (limited) return limited;

  const { id } = await params;
  const parsed = await parseBody(req, publicReviewDetailsSchema);
  if (parsed.error) return parsed.error;
  const data = parsed.data;

  // Bot honeypot tripped: pretend success, write nothing.
  if (data.website) return json({ ok: true });

  try {
    const review = await db.review.findUnique({ where: { id } });
    if (!review) return notFound("Review not found");

    // Abuse guard: the review id acts as the funnel token, and it is only
    // valid for 24 hours after the star tap. This stops old links from being
    // replayed to overwrite feedback or farm loyalty visits.
    const MAX_AGE_MS = 24 * 60 * 60 * 1000;
    if (Date.now() - review.createdAt.getTime() > MAX_AGE_MS) {
      return badRequest("This review link has expired");
    }

    const reviewUpdate: {
      comment?: string;
      clickedGoogle?: boolean;
      customerId?: string;
    } = {};
    if (data.comment !== undefined) reviewUpdate.comment = data.comment;
    if (data.clickedGoogle !== undefined)
      reviewUpdate.clickedGoogle = data.clickedGoogle;

    // Granted welcome reward (first-time completers only) — surfaced to the
    // guest in the response as their counter-proof.
    let welcomeReward: {
      code: string;
      rewardText: string;
      expiresAt: string | null;
    } | null = null;

    if (data.customer) {
      const c = data.customer;

      // Loyalty economics + welcome-reward config, per business (one read).
      const config = await db.business.findUnique({
        where: { id: review.businessId },
        select: {
          pointsPerVisit: true,
          silverThreshold: true,
          goldThreshold: true,
          vipThreshold: true,
          welcomeRewardEnabled: true,
          welcomeRewardText: true,
          welcomeRewardExpiryDays: true,
        },
      });
      if (!config) return notFound("Business not found");
      const loyalty = config;

      // Bearer code pre-generated outside the transaction; on the (astronomically
      // rare) unique collision the whole transaction retries once with a new code.
      let rewardCode = generateRewardCode();

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await db.$transaction(
        async (tx) => {
          // Match an existing customer within the SAME business — phone
          // first, then email — so repeat guests don't create duplicate rows.
          let customer = c.phone
            ? await tx.customer.findFirst({
                where: { businessId: review.businessId, phone: c.phone },
              })
            : null;
          if (!customer && c.email) {
            customer = await tx.customer.findFirst({
              where: { businessId: review.businessId, email: c.email },
            });
          }

          // SECURITY: this endpoint is unauthenticated, so a matched existing
          // customer record is NEVER mutated here — anyone who knows a phone
          // number could otherwise backfill PII or flip marketingConsent on an
          // owner-managed record (TCPA/GDPR exposure). Contact details and
          // consent are only ever written when this funnel CREATES the row.
          // Existing customers who want to change consent do it via the owner.
          if (!customer) {
            customer = await tx.customer.create({
              data: {
                businessId: review.businessId,
                firstName: c.firstName,
                phone: c.phone,
                email: c.email,
                birthday: c.birthday,
                marketingConsent: c.marketingConsent,
                source: "QR",
                // Unhappy guests leave their number so the owner can call
                // back and fix it — flag them so the CRM surfaces it.
                tags: review.rating <= 3 ? "callback-requested" : "",
              },
            });

            // Welcome reward: granted ONLY when the funnel creates the row
            // (first-time completer) and the business enabled it.
            // COMPLIANCE: this is a gift for joining the guest list — it is
            // granted at every rating identically and never references the
            // review; points-for-reviews stays forbidden.
            if (config.welcomeRewardEnabled && config.welcomeRewardText) {
              const expiresAt = new Date(
                Date.now() + config.welcomeRewardExpiryDays * 24 * 60 * 60 * 1000
              );
              const claim = await tx.rewardClaim.create({
                data: {
                  businessId: review.businessId,
                  customerId: customer.id,
                  kind: "WELCOME",
                  code: rewardCode,
                  rewardText: config.welcomeRewardText,
                  expiresAt,
                },
              });
              welcomeReward = {
                code: claim.code,
                rewardText: claim.rewardText,
                expiresAt: claim.expiresAt?.toISOString() ?? null,
              };
            }
          }

          // Atomically claim the review→customer link (compare-and-set on
          // customerId IS NULL). Exactly one concurrent PATCH wins the claim,
          // so the QR check-in visit is credited at most once per review.
          const claimed = await tx.review.updateMany({
            where: { id: review.id, customerId: null },
            data: { customerId: customer.id },
          });

          if (claimed.count === 1) {
            await tx.visit.create({
              data: {
                businessId: review.businessId,
                customerId: customer.id,
                amountCents: 0,
                pointsEarned: loyalty.pointsPerVisit,
                note: "QR check-in",
              },
            });
            // Single statement: increment visit/points AND derive the tier
            // from the post-increment count. One round trip instead of two —
            // this transaction runs against a distant DB, where round trips
            // are the budget (see timeout below).
            await tx.$executeRaw`
              UPDATE "Customer" SET
                "totalVisits"  = "totalVisits" + 1,
                "loyaltyPoints" = "loyaltyPoints" + ${loyalty.pointsPerVisit},
                "lastVisitAt"  = now(),
                "updatedAt"    = now(),
                "tier" = CASE
                  WHEN "totalVisits" + 1 >= ${loyalty.vipThreshold} THEN 'VIP'
                  WHEN "totalVisits" + 1 >= ${loyalty.goldThreshold} THEN 'GOLD'
                  WHEN "totalVisits" + 1 >= ${loyalty.silverThreshold} THEN 'SILVER'
                  ELSE 'BRONZE'
                END
              WHERE id = ${customer.id}`;
          }

          if (Object.keys(reviewUpdate).length > 0) {
            await tx.review.update({
              where: { id: review.id },
              data: reviewUpdate,
            });
          }
        },
        // Prisma's 5s default assumes a nearby DB. This transaction is up to
        // ~8 round trips; against a distant region that exceeds 5s and dies
        // with P2028 mid-flight ("Could not save your details" for guests).
        { maxWait: 10_000, timeout: 30_000 }
      );
          break; // transaction committed
        } catch (txErr) {
          // Retry the whole (rolled-back) transaction ONCE with a fresh code
          // if the reward code collided; anything else propagates.
          const isCodeCollision =
            txErr instanceof Prisma.PrismaClientKnownRequestError &&
            txErr.code === "P2002" &&
            JSON.stringify(txErr.meta ?? {}).includes("code");
          if (isCodeCollision && attempt === 0) {
            rewardCode = generateRewardCode();
            welcomeReward = null;
            continue;
          }
          throw txErr;
        }
      }
    } else if (Object.keys(reviewUpdate).length > 0) {
      await db.review.update({
        where: { id: review.id },
        data: reviewUpdate,
      });
    }

    return json({ ok: true, ...(welcomeReward ? { welcomeReward } : {}) });
  } catch (err) {
    console.error("public review update failed", err);
    return serverError();
  }
}
