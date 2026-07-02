import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Fixed-window rate limiter backed by Postgres, so limits hold across
// serverless instances without adding Redis. One RateLimit row per
// (route, client) bucket, incremented atomically with INSERT..ON CONFLICT.
// Stale rows are purged by the weekly digest cron.
// ---------------------------------------------------------------------------

/**
 * Returns null when the request is allowed, or a ready-to-return 429
 * response when the bucket is over its limit.
 *
 * Fails OPEN: if the limiter itself errors, the request proceeds — a
 * rate-limiter outage must never take down the public funnel.
 */
export async function rateLimit(opts: {
  /** Bucket key, e.g. `pub:review:${ip}`. */
  key: string;
  /** Max requests per window. */
  limit: number;
  windowSeconds: number;
}): Promise<NextResponse | null> {
  // Local dev shares one IP bucket ("unknown"/localhost), so repeated manual
  // testing trips limits meant for strangers on the internet. Enforce only in
  // production, unless RATE_LIMIT_ENABLED=true forces it on for testing.
  const enforced =
    process.env.RATE_LIMIT_ENABLED === "true" ||
    (process.env.NODE_ENV === "production" &&
      process.env.RATE_LIMIT_ENABLED !== "false");
  if (!enforced) return null;

  try {
    const rows = await db.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "RateLimit" ("key", "count", "windowEnd")
      VALUES (${opts.key}, 1, now() + make_interval(secs => ${opts.windowSeconds}))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimit"."windowEnd" < now() THEN 1
          ELSE "RateLimit"."count" + 1
        END,
        "windowEnd" = CASE
          WHEN "RateLimit"."windowEnd" < now() THEN EXCLUDED."windowEnd"
          ELSE "RateLimit"."windowEnd"
        END
      RETURNING "count"
    `;
    const count = rows[0]?.count ?? 0;
    if (count > opts.limit) {
      return NextResponse.json(
        { error: "Too many requests — please try again later" },
        { status: 429 }
      );
    }
    return null;
  } catch (err) {
    console.error("rate limit check failed", err);
    return null;
  }
}

/** Best-effort client IP (Vercel/proxies set x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (
    fwd?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/** Delete buckets whose window closed more than a day ago. */
export async function purgeStaleRateLimits(): Promise<number> {
  const result = await db.rateLimit.deleteMany({
    where: { windowEnd: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  return result.count;
}
