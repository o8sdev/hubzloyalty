import { after } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, json, serverError } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { supabaseServer, supabaseAdmin, buildGuestClaims } from "@/lib/supabase";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { recordAudit } from "@/lib/audit";

const invalid = () =>
  NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

export async function POST(req: Request) {
  const limited = await rateLimit({
    key: `guest:login:${clientIp(req)}`,
    limit: 20,
    windowSeconds: 15 * 60,
  });
  if (limited) return limited;

  const parsed = await parseBody(req, loginSchema);
  if (parsed.error) return parsed.error;
  const { email, password } = parsed.data;

  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return invalid();

    // Must be a GUEST account — a business/admin identity signing in here is
    // rejected (and its just-set cookie revoked), keeping the surfaces separate.
    const guest = await db.guest.findUnique({ where: { authId: data.user.id } });
    if (!guest) {
      await supabase.auth.signOut();
      return invalid();
    }

    try {
      await supabaseAdmin().auth.admin.updateUserById(data.user.id, {
        app_metadata: buildGuestClaims(guest.id),
      });
    } catch (syncErr) {
      console.error("guest claim sync on login failed", syncErr);
    }

    after(() =>
      recordAudit({
        businessId: null,
        actor: { userId: guest.id, email: guest.email, role: "GUEST" },
        action: "guest.login",
        summary: "Guest signed in",
        ip: clientIp(req),
      })
    );
    return json({ ok: true });
  } catch (err) {
    console.error("guest login failed", err);
    return serverError("Login failed");
  }
}
