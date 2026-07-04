import { after } from "next/server";
import { db } from "@/lib/db";
import {
  badRequest,
  forbidden,
  json,
  notFound,
  requireApiSession,
  serverError,
} from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase";
import { actorFromSession, recordAudit } from "@/lib/audit";

/**
 * Owner/admin removes a team member from their own business. Owners cannot
 * be removed here (platform admin handles ownership changes) and nobody can
 * remove themselves.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const { businessId, role, userId } = auth.session;
  if (role !== "OWNER" && role !== "ADMIN") return forbidden();

  const { id } = await params;
  if (id === userId) return badRequest("You cannot remove your own account");

  try {
    const member = await db.user.findFirst({
      where: { id, businessId },
      select: { id: true, name: true, email: true, role: true, authId: true, isPlatformAdmin: true },
    });
    if (!member) return notFound("Team member not found");
    if (member.role === "OWNER" || member.isPlatformAdmin) {
      return badRequest("Owners can only be changed by platform support");
    }

    await db.user.delete({ where: { id: member.id } });
    if (member.authId) {
      await supabaseAdmin()
        .auth.admin.deleteUser(member.authId)
        .catch((e) => console.error("auth user delete failed", e));
    }
    after(() =>
      recordAudit({
        businessId,
        actor: actorFromSession(auth.session),
        action: "team.remove",
        summary: `Removed staff member ${member.name} (${member.email})`,
        targetType: "user",
        targetId: member.id,
      })
    );
    return json({ ok: true });
  } catch (err) {
    console.error("team member remove failed", err);
    return serverError("Could not remove the team member");
  }
}
