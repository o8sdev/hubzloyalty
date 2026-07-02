import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { parseBody, json, serverError } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { createSession } from "@/lib/session";
import { NextResponse } from "next/server";

const invalidCredentials = () =>
  NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

export async function POST(req: Request) {
  const parsed = await parseBody(req, loginSchema);
  if (parsed.error) return parsed.error;
  const { email, password } = parsed.data;

  try {
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.businessId) return invalidCredentials();

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return invalidCredentials();

    await createSession({
      userId: user.id,
      businessId: user.businessId,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    return json({ ok: true });
  } catch (err) {
    console.error("login failed", err);
    return serverError("Login failed");
  }
}
