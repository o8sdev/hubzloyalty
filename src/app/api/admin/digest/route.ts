import { json, requireApiPlatformAdmin, serverError } from "@/lib/http";
import { runWeeklyDigest } from "@/lib/digest";

export const maxDuration = 300;

/** ADMIN endpoint. Runs the weekly digest immediately ("send now"). */
export async function POST() {
  const auth = await requireApiPlatformAdmin();
  if (auth.error) return auth.error;

  try {
    const result = await runWeeklyDigest();
    return json({ ok: true, ...result });
  } catch (err) {
    console.error("admin digest run failed", err);
    return serverError("Digest run failed");
  }
}
