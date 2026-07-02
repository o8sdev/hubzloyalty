import { db } from "@/lib/db";
import {
  forbidden,
  json,
  notFound,
  parseBody,
  requireApiSession,
  serverError,
} from "@/lib/http";
import { businessUpdateSchema } from "@/lib/validation";
import type { Business } from "@prisma/client";

type SocialLinks = { instagram?: string; facebook?: string; tiktok?: string };

/** Parse the socialLinks JSON string column into an object (null-safe). */
function parseSocialLinks(raw: string | null): SocialLinks | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    const links: SocialLinks = {};
    if (typeof obj.instagram === "string") links.instagram = obj.instagram;
    if (typeof obj.facebook === "string") links.facebook = obj.facebook;
    if (typeof obj.tiktok === "string") links.tiktok = obj.tiktok;
    return links;
  } catch {
    return null;
  }
}

function serializeBusiness(business: Business) {
  return {
    ...business,
    socialLinks: parseSocialLinks(business.socialLinks),
  };
}

export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  try {
    // The session's businessId IS the tenant scope for this lookup.
    const business = await db.business.findUnique({
      where: { id: auth.session.businessId },
    });
    if (!business) return notFound("Business not found");

    return json({ business: serializeBusiness(business) });
  } catch (err) {
    console.error("business GET failed", err);
    return serverError("Could not load business");
  }
}

export async function PATCH(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  if (auth.session.role !== "OWNER" && auth.session.role !== "ADMIN") {
    return forbidden();
  }

  const parsed = await parseBody(req, businessUpdateSchema);
  if (parsed.error) return parsed.error;
  const { socialLinks, ...rest } = parsed.data;

  try {
    const existing = await db.business.findUnique({
      where: { id: auth.session.businessId },
      select: { id: true },
    });
    if (!existing) return notFound("Business not found");

    const business = await db.business.update({
      where: { id: auth.session.businessId },
      data: {
        ...rest,
        ...(socialLinks !== undefined
          ? { socialLinks: JSON.stringify(socialLinks) }
          : {}),
      },
    });

    return json({ business: serializeBusiness(business) });
  } catch (err) {
    console.error("business PATCH failed", err);
    return serverError("Could not update business");
  }
}
