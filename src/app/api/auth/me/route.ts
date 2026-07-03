import { db } from "@/lib/db";
import { json, unauthorized } from "@/lib/http";
import { getSession } from "@/lib/session";

/**
 * Uses getSession() directly (not requireApiSession) so platform-only
 * accounts (businessId "") and recovery sessions can also identify
 * themselves — business is simply null for them.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const business = session.businessId
    ? await db.business.findUnique({
        where: { id: session.businessId },
        select: { id: true, name: true, slug: true, googleReviewUrl: true },
      })
    : null;

  return json({
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
      platformAdmin: session.platformAdmin,
    },
    business,
  });
}
