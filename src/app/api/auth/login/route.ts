import { db } from "@/lib/db";
import { parseBody, json, serverError } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { supabaseServer, syncAuthClaims } from "@/lib/supabase";
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
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) return invalidCredentials();

    // The profile is the source of truth for gating; the sign-in above set
    // session cookies which we revoke again on any gate failure.
    const user = await db.user.findUnique({
      where: { authId: data.user.id },
      include: { business: { select: { suspendedAt: true } } },
    });

    // Platform admins may have no business; everyone else needs one.
    if (!user || (!user.businessId && !user.isPlatformAdmin)) {
      await supabase.auth.signOut();
      return invalidCredentials();
    }

    if (user.business?.suspendedAt && !user.isPlatformAdmin) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "This account has been suspended. Contact support." },
        { status: 403 }
      );
    }

    // Heal claim drift (e.g. profile edited while auth was unreachable) so
    // this fresh session carries current facts.
    try {
      await syncAuthClaims(user);
    } catch (syncErr) {
      console.error("claim sync on login failed", syncErr);
    }

    return json({
      ok: true,
      admin: user.isPlatformAdmin,
      mustChangePassword: user.mustChangePassword,
    });
  } catch (err) {
    console.error("login failed", err);
    return serverError("Login failed");
  }
}
