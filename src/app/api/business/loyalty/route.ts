import { forbidden, json, parseBody, requireApiSession, serverError } from "@/lib/http";
import { loyaltySettingsSchema } from "@/lib/validation";
import { applyLoyaltyConfig } from "@/lib/loyalty";

/**
 * Update the business's loyalty program configuration. Because tiers are
 * stored on customers (so lists/filters stay cheap), changing thresholds
 * recomputes every customer's tier in the same transaction (src/lib/loyalty.ts).
 */
export async function PATCH(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const { businessId, role } = auth.session;
  if (role !== "OWNER" && role !== "ADMIN") return forbidden();

  const parsed = await parseBody(req, loyaltySettingsSchema);
  if (parsed.error) return parsed.error;

  try {
    const loyalty = await applyLoyaltyConfig(businessId, parsed.data);
    return json({ ok: true, loyalty });
  } catch (err) {
    console.error("loyalty settings update failed", err);
    return serverError("Could not update loyalty settings");
  }
}
