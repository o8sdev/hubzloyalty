import { after } from "next/server";
import { db } from "@/lib/db";
import { json, notFound, parseBody, serverError } from "@/lib/http";
import { publicReviewCreateSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { sendComplaintAlert } from "@/lib/alerts";

/**
 * PUBLIC endpoint — no auth. Step one of the QR review funnel: a guest taps
 * a star rating on /r/[slug]. Creates the Review row and hands back what the
 * client needs for the follow-up steps.
 *
 * Compliance note: the funnel is UNGATED — every rating gets the same pair of
 * options (public Google review + private note). Nothing here routes guests
 * differently based on the rating.
 */
export async function POST(req: Request) {
  const limited = await rateLimit({
    key: `pub:review:${clientIp(req)}`,
    limit: 30,
    windowSeconds: 60 * 60,
  });
  if (limited) return limited;

  const parsed = await parseBody(req, publicReviewCreateSchema);
  if (parsed.error) return parsed.error;
  const { slug, rating, website } = parsed.data;

  try {
    const business = await db.business.findUnique({
      where: { slug },
      select: { id: true, name: true, googleReviewUrl: true, suspendedAt: true },
    });
    if (!business || business.suspendedAt) return notFound("Business not found");

    // Bot honeypot tripped: pretend success, write nothing.
    if (website) {
      return json(
        { reviewId: "ok", businessName: business.name, googleReviewUrl: null },
        { status: 201 }
      );
    }

    const review = await db.review.create({
      data: {
        businessId: business.id,
        rating,
        status: "NEW",
      },
    });

    // Owner complaint alert (rating <= 3), sent after the response so the
    // guest never waits on email delivery.
    if (rating <= 3) {
      after(() => sendComplaintAlert(review.id));
    }

    return json(
      {
        reviewId: review.id,
        businessName: business.name,
        googleReviewUrl: business.googleReviewUrl,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("public review create failed", err);
    return serverError();
  }
}
