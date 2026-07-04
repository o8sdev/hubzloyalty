import { after } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, json, serverError } from "@/lib/http";
import { guestRegisterSchema } from "@/lib/validation";
import { supabaseAdmin, supabaseServer, buildGuestClaims } from "@/lib/supabase";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { recordAudit } from "@/lib/audit";

// Controlled guest self-registration: creates the auth identity via the admin
// API (so the project's `disable_signup` stays ON), links a domain Guest row,
// mirrors GUEST claims into app_metadata, and signs the browser in. Rolls back
// the auth user if any later step fails.
export async function POST(req: Request) {
  const limited = await rateLimit({
    key: `guest:register:${clientIp(req)}`,
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (limited) return limited;

  const parsed = await parseBody(req, guestRegisterSchema);
  if (parsed.error) return parsed.error;
  const { name, email, password, website } = parsed.data;

  // Honeypot: a filled hidden field means a bot — feign success, do nothing.
  if (website) return json({ ok: true });

  const admin = supabaseAdmin();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (createErr || !created.user) {
    const msg = createErr?.message ?? "";
    if (/already|registered|exists|taken/i.test(msg)) {
      return NextResponse.json(
        { error: "That email is already registered." },
        { status: 409 }
      );
    }
    console.error("guest auth create failed", createErr);
    return serverError("Could not create your account");
  }
  const authId = created.user.id;

  try {
    const guest = await db.guest.create({ data: { authId, email, name } });

    const { error: metaErr } = await admin.auth.admin.updateUserById(authId, {
      app_metadata: buildGuestClaims(guest.id),
    });
    if (metaErr) throw new Error(metaErr.message);

    // Establish the session cookie for this browser.
    const supabase = await supabaseServer();
    await supabase.auth.signInWithPassword({ email, password });

    after(() =>
      recordAudit({
        businessId: null,
        actor: { userId: guest.id, email, role: "GUEST" },
        action: "guest.register",
        summary: "Guest signed up",
        ip: clientIp(req),
      })
    );
    return json({ ok: true });
  } catch (err) {
    console.error("guest register failed — rolling back", err);
    await db.guest.deleteMany({ where: { authId } }).catch(() => {});
    await admin.auth.admin.deleteUser(authId).catch(() => {});
    return serverError("Could not finish creating your account");
  }
}
