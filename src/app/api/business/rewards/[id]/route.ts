import { after } from "next/server";
import { db } from "@/lib/db";
import {
  forbidden,
  json,
  notFound,
  parseBody,
  requireApiSession,
  serverError,
} from "@/lib/http";
import { rewardUpdateSchema } from "@/lib/validation";
import { actorFromSession, recordAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

/** Edit a reward (incl. active toggle). Owner/admin only. */
export async function PATCH(req: Request, { params }: RouteContext) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  if (auth.session.role !== "OWNER" && auth.session.role !== "ADMIN") {
    return forbidden();
  }
  const { id } = await params;

  const parsed = await parseBody(req, rewardUpdateSchema);
  if (parsed.error) return parsed.error;

  try {
    const existing = await db.reward.findFirst({
      where: { id, businessId: auth.session.businessId },
      select: { id: true },
    });
    if (!existing) return notFound("Reward not found");

    const reward = await db.reward.update({
      where: { id },
      data: parsed.data,
    });
    after(() =>
      recordAudit({
        businessId: auth.session.businessId,
        actor: actorFromSession(auth.session),
        action: "reward.update",
        summary: `Updated reward "${reward.name}"`,
        targetType: "reward",
        targetId: reward.id,
      })
    );
    return json({ reward });
  } catch (err) {
    console.error("reward update failed", err);
    return serverError("Could not update reward");
  }
}

/** Delete a reward. Redemption history survives (rewardId → SetNull, name is
 *  frozen on each Redemption). Owner/admin only. */
export async function DELETE(_req: Request, { params }: RouteContext) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  if (auth.session.role !== "OWNER" && auth.session.role !== "ADMIN") {
    return forbidden();
  }
  const { id } = await params;

  try {
    const existing = await db.reward.findFirst({
      where: { id, businessId: auth.session.businessId },
      select: { id: true, name: true },
    });
    if (!existing) return notFound("Reward not found");

    await db.reward.delete({ where: { id } });
    after(() =>
      recordAudit({
        businessId: auth.session.businessId,
        actor: actorFromSession(auth.session),
        action: "reward.delete",
        summary: `Deleted reward "${existing.name}"`,
        targetType: "reward",
        targetId: id,
      })
    );
    return json({ ok: true });
  } catch (err) {
    console.error("reward delete failed", err);
    return serverError("Could not delete reward");
  }
}
