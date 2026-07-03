import { redirect } from "next/navigation";
import {
  claimsFromAuthUser,
  getVerifiedAuthUser,
  invalidateVerifiedAuthUser,
  supabaseServer,
} from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Session facade over Supabase Auth. The rest of the app keeps consuming the
// same Session shape it always has; underneath, the caller's access token is
// verified and the authorization claims are read from app_metadata (mirrored
// there from the User profile — see src/lib/supabase.ts).
// ---------------------------------------------------------------------------

export type Session = {
  /** Domain User.id (cuid) — NOT the auth.users UUID. */
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

export async function getSession(): Promise<Session | null> {
  try {
    const user = await getVerifiedAuthUser();
    if (!user) return null;
    const claims = claimsFromAuthUser(user);
    if (!claims) return null;
    return {
      userId: claims.profileId,
      businessId: claims.businessId,
      role: claims.role,
      platformAdmin: claims.platformAdmin,
      mustChangePassword: claims.mustChangePassword,
      name:
        typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : "",
      email: user.email ?? "",
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
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  invalidateVerifiedAuthUser();
}
