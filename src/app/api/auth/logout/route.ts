import { after } from "next/server";
import { destroySession, getSession } from "@/lib/session";
import { json } from "@/lib/http";
import { actorFromSession, recordAudit } from "@/lib/audit";

export async function POST() {
  // Capture the actor before the session is torn down.
  const session = await getSession();
  await destroySession();
  if (session) {
    after(() =>
      recordAudit({
        businessId: session.businessId || null,
        actor: actorFromSession(session),
        action: "auth.logout",
        summary: "Signed out",
      })
    );
  }
  return json({ ok: true });
}
