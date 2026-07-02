import { db } from "@/lib/db";
import { badRequest, json, notFound, parseBody, serverError } from "@/lib/http";
import { publicReviewDetailsSchema, tierForVisits } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/ratelimit";

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

    if (data.customer) {
      const c = data.customer;

      // Loyalty economics are configured per business.
      const loyalty = await db.business.findUnique({
        where: { id: review.businessId },
        select: {
          pointsPerVisit: true,
          silverThreshold: true,
          goldThreshold: true,
          vipThreshold: true,
        },
      });
      if (!loyalty) return notFound("Business not found");

      await db.$transaction(async (tx) => {
        // Match an existing customer within the SAME business — phone first,
        // then email — so repeat guests don't create duplicate rows.
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
            },
          });
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
          // Tier derives from the post-increment count returned by the
          // update, so concurrent visit logs can't leave it stale.
          const updated = await tx.customer.update({
            where: { id: customer.id },
            data: {
              totalVisits: { increment: 1 },
              loyaltyPoints: { increment: loyalty.pointsPerVisit },
              lastVisitAt: new Date(),
            },
          });
          await tx.customer.update({
            where: { id: customer.id },
            data: { tier: tierForVisits(updated.totalVisits, loyalty) },
          });
        }

        if (Object.keys(reviewUpdate).length > 0) {
          await tx.review.update({
            where: { id: review.id },
            data: reviewUpdate,
          });
        }
      });
    } else if (Object.keys(reviewUpdate).length > 0) {
      await db.review.update({
        where: { id: review.id },
        data: reviewUpdate,
      });
    }

    return json({ ok: true });
  } catch (err) {
    console.error("public review update failed", err);
    return serverError();
  }
}
