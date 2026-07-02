import { db } from "@/lib/db";
import { json, notFound, parseBody, serverError } from "@/lib/http";
import { publicReviewCreateSchema } from "@/lib/validation";

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
  const parsed = await parseBody(req, publicReviewCreateSchema);
  if (parsed.error) return parsed.error;
  const { slug, rating } = parsed.data;

  try {
    const business = await db.business.findUnique({
      where: { slug },
      select: { id: true, name: true, googleReviewUrl: true },
    });
    if (!business) return notFound("Business not found");

    const review = await db.review.create({
      data: {
        businessId: business.id,
        rating,
        status: "NEW",
      },
    });

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
