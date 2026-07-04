import { after } from "next/server";
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
import { guestReviewSchema } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";

// A signed-in guest leaves a first-party review (channel APP) for a place they
// have a membership at (i.e. have checked in). COMPLIANCE: every rating is
// saved and shown the same way (never gated), and reviews never award points.
export async function POST(req: Request) {
  const auth = await requireApiGuestSession();
  if (auth.error) return auth.error;
  const { guestId, email } = auth.guest;

  const parsed = await parseBody(req, guestReviewSchema);
  if (parsed.error) return parsed.error;
  const { slug, rating, comment } = parsed.data;

  try {
    const business = await db.business.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true, suspendedAt: true },
    });
    if (!business) return notFound("We couldn't find that place.");
    if (business.suspendedAt) return forbidden();

    // Anti-fake: only guests with a CONFIRMED visit may review. `totalVisits`
    // is incremented solely when staff confirm a check-in (creditVisit), so a
    // guest who merely scanned (a pending, unconfirmed check-in) is blocked.
    const customer = await db.customer.findFirst({
      where: { businessId: business.id, guestId },
      select: { id: true, totalVisits: true },
    });
    if (!customer || customer.totalVisits < 1) {
      return badRequest("You can review here after a confirmed check-in.");
    }

    // Low ratings enter the owner's inbox as NEW, like the funnel.
    const status = rating <= 3 ? "NEW" : "RESOLVED";
    const existing = await db.review.findFirst({
      where: { businessId: business.id, guestId, channel: "APP" },
      select: { id: true },
    });
    if (existing) {
      await db.review.update({
        where: { id: existing.id },
        data: { rating, comment, status },
      });
    } else {
      await db.review.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          guestId,
          rating,
          comment,
          channel: "APP",
          status,
        },
      });
    }

    after(() =>
      recordAudit({
        businessId: business.id,
        actor: { userId: guestId, email, role: "GUEST" },
        action: "guest.review",
        summary: `Guest left a ${rating}★ review`,
        targetType: "review",
      })
    );
    return json({ ok: true });
  } catch (err) {
    console.error("guest review failed", err);
    return serverError("Could not save your review");
  }
}
