import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  badRequest,
  json,
  parseBody,
  requireApiPlatformAdmin,
  serverError,
} from "@/lib/http";
import { adminUserCreateSchema } from "@/lib/validation";

/** ADMIN endpoint. Creates a user, optionally attached to a business. */
export async function POST(req: Request) {
  const auth = await requireApiPlatformAdmin();
  if (auth.error) return auth.error;

  const parsed = await parseBody(req, adminUserCreateSchema);
  if (parsed.error) return parsed.error;
  const { name, email, password, role, businessId, isPlatformAdmin } = parsed.data;

  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return badRequest("A user with this email already exists");

    if (businessId) {
      const business = await db.business.findUnique({
        where: { id: businessId },
        select: { id: true },
      });
      if (!business) return badRequest("Business not found");
    }
    if (!businessId && !isPlatformAdmin) {
      return badRequest(
        "A user needs a business or the platform-admin flag — otherwise they cannot log in"
      );
    }

    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role,
        businessId: businessId ?? null,
        isPlatformAdmin,
      },
    });

    return json({ ok: true, userId: user.id }, { status: 201 });
  } catch (err) {
    console.error("admin user create failed", err);
    return serverError("Could not create user");
  }
}
