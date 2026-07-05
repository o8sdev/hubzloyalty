import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { badRequest, json, notFound, parseBody, serverError } from "@/lib/http";
import { publicReviewDetailsSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { generateRewardCode } from "@/lib/onetime";
import {
  CHECKIN_TTL_MS,
  checkEarnEligibility,
  generateUniqueBearerCode,
} from "@/lib/checkins";

/**
 * PUBLIC endpoint — no auth. Steps two and three of the QR funnel: the guest
 * can attach a private comment, record that they clicked through to Google,
 * and optionally join the loyalty list (contact capture).
 *
 * POINTS ARE NEVER CREDITED HERE. Completing the funnel mints a short-lived
 * CHECK-IN CODE (subject to the business's cooldown/daily cap); a staff
 * member confirming that code at the counter/table is what creates the Visit
 * and credits points (see /api/counter). Feedback itself is never gated.
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
    // Minted (or re-shown) check-in awaiting staff confirmation.
    let checkin: { code: string; expiresAt: string; tableNumber: string | null } | null =
      null;
    let earnStatus: "code" | "cooldown" | "capped" | "none" = "none";

    if (data.customer) {
      const c = data.customer;

      const config = await db.business.findUnique({
        where: { id: review.businessId },
        select: {
          welcomeRewardEnabled: true,
          welcomeRewardText: true,
          welcomeRewardExpiryDays: true,
          welcomeRewardValueCents: true,
          earnCooldownHours: true,
          maxEarnPerDay: true,
        },
      });
      if (!config) return notFound("Business not found");

      // Match outside the transaction to run the (multi-query) eligibility
      // check cheaply; the transaction re-checks for creation races.
      const existing = c.phone
        ? await db.customer.findFirst({
            where: { businessId: review.businessId, phone: c.phone },
            select: { id: true },
          })
        : c.email
          ? await db.customer.findFirst({
              where: { businessId: review.businessId, email: c.email },
              select: { id: true },
            })
          : null;
      const matched =
        existing ??
        (c.phone && c.email
          ? await db.customer.findFirst({
              where: { businessId: review.businessId, email: c.email },
              select: { id: true },
            })
          : null);

      let eligibility:
        | Awaited<ReturnType<typeof checkEarnEligibility>>
        | { state: "ok" } = { state: "ok" };
      if (matched) {
        eligibility = await checkEarnEligibility({
          businessId: review.businessId,
          customerId: matched.id,
          earnCooldownHours: config.earnCooldownHours,
          maxEarnPerDay: config.maxEarnPerDay,
        });
      }

      if (eligibility.state === "reuse") {
        // Same pending code re-shown — no duplicate mints from re-scans.
        checkin = {
          code: eligibility.checkin.code,
          expiresAt: eligibility.checkin.expiresAt.toISOString(),
          tableNumber: eligibility.checkin.tableNumber,
        };
        earnStatus = "code";
        await db.review.updateMany({
          where: { id: review.id, customerId: null },
          data: { customerId: matched!.id },
        });
        if (Object.keys(reviewUpdate).length > 0) {
          await db.review.update({ where: { id: review.id }, data: reviewUpdate });
        }
        return json({ ok: true, earnStatus, checkin });
      }

      if (eligibility.state === "cooldown" || eligibility.state === "capped") {
        earnStatus = eligibility.state;
        await db.review.updateMany({
          where: { id: review.id, customerId: null },
          data: { customerId: matched!.id },
        });
        if (Object.keys(reviewUpdate).length > 0) {
          await db.review.update({ where: { id: review.id }, data: reviewUpdate });
        }
        return json({ ok: true, earnStatus });
      }

      // Eligible to mint: pre-generate codes; retry once on the
      // (astronomically rare) unique collision.
      let rewardCode = generateRewardCode();
      let checkinCode = await generateUniqueBearerCode();

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await db.$transaction(
            async (tx) => {
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

              // SECURITY: this endpoint is unauthenticated, so a matched
              // existing customer record is NEVER mutated here — contact
              // details and consent are only written when this funnel
              // CREATES the row (TCPA/GDPR).
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
                    tags: review.rating <= 3 ? "callback-requested" : "",
                  },
                });

                // Welcome gift for joining the list (first completion only,
                // identical at every rating — never for the review).
                if (config.welcomeRewardEnabled && config.welcomeRewardText) {
                  const expiresAt = new Date(
                    Date.now() +
                      config.welcomeRewardExpiryDays * 24 * 60 * 60 * 1000
                  );
                  const claim = await tx.rewardClaim.create({
                    data: {
                      businessId: review.businessId,
                      customerId: customer.id,
                      kind: "WELCOME",
                      code: rewardCode,
                      rewardText: config.welcomeRewardText,
                      // Freeze the gift's cost value for accounting (the owner
                      // may change the config later; this record must not).
                      valueCents: config.welcomeRewardValueCents,
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

              // Link the review to the customer (idempotent compare-and-set).
              await tx.review.updateMany({
                where: { id: review.id, customerId: null },
                data: { customerId: customer.id },
              });

              // Mint the check-in awaiting human confirmation.
              const minted = await tx.checkin.create({
                data: {
                  businessId: review.businessId,
                  customerId: customer.id,
                  reviewId: review.customerId === null ? review.id : null,
                  code: checkinCode,
                  tableNumber: data.tableNumber ?? null,
                  expiresAt: new Date(Date.now() + CHECKIN_TTL_MS),
                },
              });
              checkin = {
                code: minted.code,
                expiresAt: minted.expiresAt.toISOString(),
                tableNumber: minted.tableNumber,
              };
              earnStatus = "code";

              if (Object.keys(reviewUpdate).length > 0) {
                await tx.review.update({
                  where: { id: review.id },
                  data: reviewUpdate,
                });
              }
            },
            // Generous budget: remote DB, several round trips (see CLAUDE.md).
            { maxWait: 10_000, timeout: 30_000 }
          );
          break;
        } catch (txErr) {
          const isCodeCollision =
            txErr instanceof Prisma.PrismaClientKnownRequestError &&
            txErr.code === "P2002" &&
            JSON.stringify(txErr.meta ?? {}).includes("code");
          if (isCodeCollision && attempt === 0) {
            rewardCode = generateRewardCode();
            checkinCode = await generateUniqueBearerCode();
            welcomeReward = null;
            checkin = null;
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

    return json({
      ok: true,
      earnStatus,
      ...(welcomeReward ? { welcomeReward } : {}),
      ...(checkin ? { checkin } : {}),
    });
  } catch (err) {
    console.error("public review update failed", err);
    return serverError();
  }
}
