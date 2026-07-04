import { after } from "next/server";
import { db } from "@/lib/db";
import {
  forbidden,
  json,
  parseBody,
  requireApiSession,
  serverError,
} from "@/lib/http";
import { rewardCreateSchema } from "@/lib/validation";
import { actorFromSession, recordAudit } from "@/lib/audit";

/** List the business's reward catalog (active first, cheapest first). */
export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  try {
    const rewards = await db.reward.findMany({
      where: { businessId: auth.session.businessId },
      orderBy: [{ active: "desc" }, { pointsCost: "asc" }],
    });
    return json({ rewards });
  } catch (err) {
    console.error("rewards list failed", err);
    return serverError("Could not load rewards");
  }
}

/** Create a reward. Owner/admin only. */
export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  if (auth.session.role !== "OWNER" && auth.session.role !== "ADMIN") {
    return forbidden();
  }

  const parsed = await parseBody(req, rewardCreateSchema);
  if (parsed.error) return parsed.error;
  const { name, description, pointsCost, costValueCents, active } = parsed.data;

  try {
    const reward = await db.reward.create({
      data: {
        businessId: auth.session.businessId,
        name,
        description,
        pointsCost,
        costValueCents,
        active,
      },
    });
    after(() =>
      recordAudit({
        businessId: auth.session.businessId,
        actor: actorFromSession(auth.session),
        action: "reward.create",
        summary: `Added reward "${name}" (${pointsCost} pts)`,
        targetType: "reward",
        targetId: reward.id,
      })
    );
    return json({ reward }, { status: 201 });
  } catch (err) {
    console.error("reward create failed", err);
    return serverError("Could not create reward");
  }
}
