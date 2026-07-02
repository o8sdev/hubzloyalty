import { db } from "@/lib/db";
import { json, requireApiSession } from "@/lib/http";

export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const { session } = auth;

  const business = await db.business.findUnique({
    where: { id: session.businessId },
    select: { id: true, name: true, slug: true, googleReviewUrl: true },
  });

  return json({
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
    },
    business,
  });
}
