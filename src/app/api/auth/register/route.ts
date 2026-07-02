import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { parseBody, badRequest, json, serverError } from "@/lib/http";
import { registerSchema, slugify } from "@/lib/validation";
import { createSession } from "@/lib/session";

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let i = 0; i < 20; i++) {
    const existing = await db.business.findUnique({ where: { slug } });
    if (!existing) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  throw new Error("Could not generate a unique slug");
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, registerSchema);
  if (parsed.error) return parsed.error;
  const { businessName, name, email, password } = parsed.data;

  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return badRequest("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const slug = await uniqueSlug(slugify(businessName));

    const business = await db.business.create({
      data: {
        name: businessName,
        slug,
        users: {
          create: { email, passwordHash, name, role: "OWNER" },
        },
      },
      include: { users: true },
    });

    const user = business.users[0];
    await createSession({
      userId: user.id,
      businessId: business.id,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    return json({ ok: true, businessId: business.id, slug: business.slug });
  } catch (err) {
    console.error("register failed", err);
    return serverError("Registration failed");
  }
}
