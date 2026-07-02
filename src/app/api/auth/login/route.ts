import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { parseBody, json, serverError } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { createSession } from "@/lib/session";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { NextResponse } from "next/server";

const invalidCredentials = () =>
  NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

export async function POST(req: Request) {
  const limited = await rateLimit({
    key: `auth:login:${clientIp(req)}`,
    limit: 20,
    windowSeconds: 15 * 60,
  });
  if (limited) return limited;

  const parsed = await parseBody(req, loginSchema);
  if (parsed.error) return parsed.error;
  const { email, password } = parsed.data;

  try {
    const user = await db.user.findUnique({
      where: { email },
      include: { business: { select: { suspendedAt: true } } },
    });
    // Platform admins may have no business; everyone else needs one.
    if (!user || (!user.businessId && !user.isPlatformAdmin)) {
      return invalidCredentials();
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return invalidCredentials();

    if (user.business?.suspendedAt && !user.isPlatformAdmin) {
      return NextResponse.json(
        { error: "This account has been suspended. Contact support." },
        { status: 403 }
      );
    }

    await createSession({
      userId: user.id,
      businessId: user.businessId ?? "",
      role: user.role,
      platformAdmin: user.isPlatformAdmin,
      name: user.name,
      email: user.email,
    });

    return json({ ok: true, admin: user.isPlatformAdmin });
  } catch (err) {
    console.error("login failed", err);
    return serverError("Login failed");
  }
}
