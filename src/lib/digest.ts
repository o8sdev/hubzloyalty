import { db } from "@/lib/db";
import { appUrl, renderEmail, sendMail } from "@/lib/mail";
import { purgeStaleRateLimits } from "@/lib/ratelimit";

// ---------------------------------------------------------------------------
// Weekly owner digest: the persona review was blunt — owners live in their
// inbox, not in dashboards. One email per business per week with the numbers
// that matter. Invoked by the Vercel cron route (/api/cron/digest) and the
// admin "run now" button (/api/admin/digest).
// ---------------------------------------------------------------------------

export type BusinessDigest = {
  scans: number; // funnel star taps this week
  avgRating: number | null;
  googleClicks: number;
  privateNotes: number;
  newContacts: number;
  visits: number;
  openComplaints: number; // all-time NEW complaints, not just this week
};

export async function computeDigest(
  businessId: string,
  since: Date
): Promise<BusinessDigest> {
  const [reviewAgg, googleClicks, privateNotes, newContacts, visits, openComplaints] =
    await Promise.all([
      db.review.aggregate({
        where: { businessId, createdAt: { gte: since } },
        _count: true,
        _avg: { rating: true },
      }),
      db.review.count({
        where: { businessId, createdAt: { gte: since }, clickedGoogle: true },
      }),
      db.review.count({
        where: { businessId, createdAt: { gte: since }, comment: { not: null } },
      }),
      db.customer.count({ where: { businessId, createdAt: { gte: since } } }),
      db.visit.count({ where: { businessId, visitedAt: { gte: since } } }),
      db.review.count({
        where: { businessId, status: "NEW", rating: { lte: 3 } },
      }),
    ]);

  return {
    scans: reviewAgg._count,
    avgRating: reviewAgg._avg.rating,
    googleClicks,
    privateNotes,
    newContacts,
    visits,
    openComplaints,
  };
}

function statRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b">${label}</td>
    <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;color:#0f172a">${value}</td>
  </tr>`;
}

export async function sendBusinessDigest(business: {
  id: string;
  name: string;
}): Promise<number> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const digest = await computeDigest(business.id, since);

  const recipients = await db.user.findMany({
    where: { businessId: business.id, role: { in: ["OWNER", "ADMIN"] } },
    select: { email: true },
  });
  if (recipients.length === 0) return 0;

  const rows =
    statRow("Review page scans", String(digest.scans)) +
    statRow(
      "Average rating",
      digest.avgRating === null ? "—" : `${digest.avgRating.toFixed(1)} ★`
    ) +
    statRow("Google review clicks", String(digest.googleClicks)) +
    statRow("Private notes received", String(digest.privateNotes)) +
    statRow("New loyalty contacts", String(digest.newContacts)) +
    statRow("Visits logged", String(digest.visits));

  const complaintLine =
    digest.openComplaints > 0
      ? `<p style="margin-top:16px"><strong>${digest.openComplaints} piece${digest.openComplaints === 1 ? "" : "s"} of feedback ${digest.openComplaints === 1 ? "needs" : "need"} attention</strong> in your inbox.</p>`
      : `<p style="margin-top:16px">Nothing outstanding in your feedback inbox — nice.</p>`;

  const html = renderEmail({
    heading: `Your week at ${business.name}`,
    bodyHtml:
      `<p>Here's what happened over the last 7 days:</p>` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;font-size:14px">${rows}</table>` +
      complaintLine,
    ctaLabel: "Open your dashboard",
    ctaUrl: appUrl("/dashboard"),
    footer: "Weekly digests can be turned off in Settings → Notifications.",
  });
  const text =
    `Your week at ${business.name}: ${digest.scans} scans, ` +
    `avg rating ${digest.avgRating?.toFixed(1) ?? "—"}, ` +
    `${digest.googleClicks} Google clicks, ${digest.newContacts} new contacts, ` +
    `${digest.visits} visits. ${appUrl("/dashboard")}`;

  let sent = 0;
  for (const r of recipients) {
    const result = await sendMail({
      to: r.email,
      subject: `Your week at ${business.name}`,
      html,
      text,
      kind: "WEEKLY_DIGEST",
      businessId: business.id,
    });
    if (result.ok) sent++;
  }
  return sent;
}

/** Send the digest to every active, opted-in business. */
export async function runWeeklyDigest(): Promise<{
  businesses: number;
  emailsSent: number;
  rateLimitRowsPurged: number;
}> {
  const businesses = await db.business.findMany({
    where: { notifyWeeklyDigest: true, suspendedAt: null },
    select: { id: true, name: true },
  });

  let emailsSent = 0;
  for (const business of businesses) {
    try {
      emailsSent += await sendBusinessDigest(business);
    } catch (err) {
      console.error(`digest failed for business ${business.id}`, err);
    }
  }

  // Piggyback housekeeping on the weekly run.
  let purged = 0;
  try {
    purged = await purgeStaleRateLimits();
  } catch (err) {
    console.error("rate limit purge failed", err);
  }

  return {
    businesses: businesses.length,
    emailsSent,
    rateLimitRowsPurged: purged,
  };
}
