import { db } from "@/lib/db";
import { appUrl, escapeHtml, renderEmail, sendMail } from "@/lib/mail";

/**
 * Email the owner(s) when a rating<=3 review lands. Called via after() from
 * the public funnel, so it must swallow its own errors.
 *
 * Dedupe: alertSentAt is claimed with an atomic compare-and-set before any
 * mail goes out — concurrent calls send at most one alert per review.
 */
export async function sendComplaintAlert(reviewId: string): Promise<void> {
  try {
    const review = await db.review.findUnique({
      where: { id: reviewId },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            email: true,
            notifyComplaints: true,
            suspendedAt: true,
            users: {
              where: { role: { in: ["OWNER", "ADMIN"] } },
              select: { email: true },
            },
          },
        },
      },
    });
    if (!review || review.rating > 3) return;
    const biz = review.business;
    if (!biz.notifyComplaints || biz.suspendedAt) return;

    const recipients = biz.users.map((u) => u.email);
    if (recipients.length === 0 && biz.email) recipients.push(biz.email);
    if (recipients.length === 0) return;

    const claimed = await db.review.updateMany({
      where: { id: review.id, alertSentAt: null },
      data: { alertSentAt: new Date() },
    });
    if (claimed.count !== 1) return;

    const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
    const subject = `${review.rating}-star rating just now at ${biz.name}`;
    const html = renderEmail({
      heading: `New ${review.rating}-star rating (${stars})`,
      bodyHtml:
        `<p>A guest at <strong>${escapeHtml(biz.name)}</strong> just left a ${review.rating}-star rating through your QR review page.</p>` +
        `<p>They may still be adding a private note or contact details — the freshest version is in your feedback inbox. Reaching out within the hour is the best chance to turn the visit around.</p>`,
      ctaLabel: "Open feedback inbox",
      ctaUrl: appUrl("/reviews"),
      footer: `Complaint alerts can be turned off in Settings → Notifications.`,
    });
    const text =
      `A guest at ${biz.name} just left a ${review.rating}-star rating.\n` +
      `See the details in your feedback inbox: ${appUrl("/reviews")}`;

    for (const to of recipients) {
      await sendMail({
        to,
        subject,
        html,
        text,
        kind: "COMPLAINT_ALERT",
        businessId: biz.id,
      });
    }
  } catch (err) {
    console.error("complaint alert failed", err);
  }
}
