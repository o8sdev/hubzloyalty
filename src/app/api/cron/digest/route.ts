import { json, unauthorized, serverError } from "@/lib/http";
import { runWeeklyDigest } from "@/lib/digest";

export const maxDuration = 300;

/**
 * Cron endpoint: weekly owner digest. Vercel cron calls GET with
 * `Authorization: Bearer ${CRON_SECRET}` (schedule in vercel.json).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return unauthorized();
  }

  try {
    const result = await runWeeklyDigest();
    return json({ ok: true, ...result });
  } catch (err) {
    console.error("weekly digest run failed", err);
    return serverError("Digest run failed");
  }
}
