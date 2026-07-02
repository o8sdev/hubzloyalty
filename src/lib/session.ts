import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "lcrm_session";
const SESSION_DAYS = 30;

export type Session = {
  userId: string;
  // "" for platform-only accounts (platform admins without a business).
  businessId: string;
  role: string; // OWNER | STAFF | ADMIN
  // Platform operator: may access /admin across all tenants.
  platformAdmin: boolean;
  // Account was provisioned with a one-time password and must set its own
  // password before using the app ((app) layout redirects to /change-password).
  mustChangePassword: boolean;
  name: string;
  email: string;
};

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createSession(session: Session) {
  const token = await new SignJWT({
    businessId: session.businessId,
    role: session.role,
    platformAdmin: session.platformAdmin,
    mustChangePassword: session.mustChangePassword,
    name: session.name,
    email: session.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub || typeof payload.businessId !== "string") return null;
    return {
      userId: payload.sub,
      businessId: payload.businessId,
      role: String(payload.role ?? "OWNER"),
      platformAdmin: payload.platformAdmin === true,
      mustChangePassword: payload.mustChangePassword === true,
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
    };
  } catch {
    return null;
  }
}

/** For server components / pages: redirects to /login when unauthenticated. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * For /admin pages: requires a platform-admin session. Non-admins land on
 * their own dashboard rather than an error page.
 */
export async function requirePlatformAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.platformAdmin) redirect("/dashboard");
  return session;
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}
