import { db } from "@/lib/db";
import type { Session } from "@/lib/session";

// ---------------------------------------------------------------------------
// Audit trail. recordAudit() writes one append-only AuditLog row and NEVER
// throws — a logging failure must never break the action it describes. Call
// it from mutation handlers (ideally inside after() so the response isn't
// delayed by the extra write).
// ---------------------------------------------------------------------------

export type AuditActor = {
  userId?: string | null;
  email: string;
  role: string; // OWNER | ADMIN | STAFF | PLATFORM_ADMIN
};

/** Derive the actor from a session (platform admins report PLATFORM_ADMIN). */
export function actorFromSession(session: Session): AuditActor {
  return {
    userId: session.userId,
    email: session.email,
    role: session.platformAdmin ? "PLATFORM_ADMIN" : session.role,
  };
}

export async function recordAudit(opts: {
  businessId?: string | null;
  actor: AuditActor;
  action: string;
  summary: string;
  targetType?: string;
  targetId?: string;
  ip?: string | null;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        businessId: opts.businessId ?? null,
        actorUserId: opts.actor.userId ?? null,
        actorEmail: opts.actor.email,
        actorRole: opts.actor.role,
        action: opts.action,
        summary: opts.summary,
        targetType: opts.targetType ?? null,
        targetId: opts.targetId ?? null,
        ip: opts.ip ?? null,
      },
    });
  } catch (err) {
    console.error("audit write failed", opts.action, err);
  }
}
