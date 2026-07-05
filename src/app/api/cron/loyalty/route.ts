import { json, unauthorized, serverError } from "@/lib/http";
import { runBirthdayBonuses, runPointsExpiry } from "@/lib/loyalty-cron";

export const maxDuration = 300;

/**
 * Cron endpoint: daily loyalty jobs — birthday bonuses + points expiry. Vercel
 * cron calls GET with `Authorization: Bearer ${CRON_SECRET}` (schedule in
 * vercel.json). Both jobs are idempotent, so a retry is safe.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return unauthorized();
  }

  try {
    // Sequential (not Promise.all) to keep the remote-DB connection pool calm.
    const birthdays = await runBirthdayBonuses();
    const expiry = await runPointsExpiry();
    return json({ ok: true, birthdays, expiry });
  } catch (err) {
    console.error("loyalty cron run failed", err);
    return serverError("Loyalty cron run failed");
  }
}
