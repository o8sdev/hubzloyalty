import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  badRequest,
  json,
  parseBody,
  requireApiPlatformAdmin,
  serverError,
} from "@/lib/http";
import { adminBusinessCreateSchema, slugify } from "@/lib/validation";

/**
 * ADMIN endpoint. Creates a business together with its owner account —
 * the concierge onboarding path (the self-serve path is /api/auth/register).
 */
export async function POST(req: Request) {
  const auth = await requireApiPlatformAdmin();
  if (auth.error) return auth.error;

  const parsed = await parseBody(req, adminBusinessCreateSchema);
  if (parsed.error) return parsed.error;
  const { name, slug: requestedSlug, owner } = parsed.data;

  try {
    const existingUser = await db.user.findUnique({
      where: { email: owner.email },
    });
    if (existingUser) {
      return badRequest("A user with this email already exists");
    }

    const slug = requestedSlug ?? slugify(name);
    const existingSlug = await db.business.findUnique({ where: { slug } });
    if (existingSlug) {
      return badRequest(`The slug "${slug}" is already taken`);
    }

    const business = await db.business.create({
      data: {
        name,
        slug,
        users: {
          create: {
            name: owner.name,
            email: owner.email,
            passwordHash: await bcrypt.hash(owner.password, 10),
            role: "OWNER",
          },
        },
      },
    });

    return json({ ok: true, businessId: business.id, slug: business.slug }, { status: 201 });
  } catch (err) {
    console.error("admin business create failed", err);
    return serverError("Could not create business");
  }
}
