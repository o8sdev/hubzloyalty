import { db } from "@/lib/db";
import { json, parseBody, serverError } from "@/lib/http";
import { demoRequestCreateSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { appUrl, escapeHtml, renderEmail, sendMail } from "@/lib/mail";

/**
 * PUBLIC endpoint — no auth. Onboarding is invite-only, so this is the whole
 * front door: a prospective café asks for a demo, a platform admin follows up
 * from /admin/demo-requests and provisions the business by hand.
 */
export async function POST(req: Request) {
  const limited = await rateLimit({
    key: `pub:demo:${clientIp(req)}`,
    limit: 3,
    windowSeconds: 3600,
  });
  if (limited) return limited;

  const parsed = await parseBody(req, demoRequestCreateSchema);
  if (parsed.error) return parsed.error;
  const { businessName, contactName, email, phone, message, website } =
    parsed.data;

  // Bot honeypot tripped: pretend success, write nothing.
  if (website) return json({ ok: true }, { status: 201 });

  try {
    await db.demoRequest.create({
      data: {
        businessName,
        contactName,
        email,
        phone,
        message,
      },
    });

    // Heads-up email to every platform admin. sendMail never throws, so a
    // mail outage can't fail the request.
    const admins = await db.user.findMany({
      where: { isPlatformAdmin: true },
      select: { email: true },
    });

    const detailLines = [
      `<p style="margin:0 0 8px"><strong>Business:</strong> ${escapeHtml(businessName)}</p>`,
      `<p style="margin:0 0 8px"><strong>Contact:</strong> ${escapeHtml(contactName)}</p>`,
      `<p style="margin:0 0 8px"><strong>Email:</strong> ${escapeHtml(email)}</p>`,
    ];
    if (phone) {
      detailLines.push(
        `<p style="margin:0 0 8px"><strong>Phone:</strong> ${escapeHtml(phone)}</p>`
      );
    }
    if (message) {
      detailLines.push(
        `<p style="margin:16px 0 0"><strong>Message:</strong></p>` +
          `<p style="margin:4px 0 0;white-space:pre-wrap">${escapeHtml(message)}</p>`
      );
    }

    const html = renderEmail({
      heading: `New demo request: ${escapeHtml(businessName)}`,
      bodyHtml: detailLines.join(""),
      ctaLabel: "Open demo requests",
      ctaUrl: appUrl("/admin/demo-requests"),
      footer: "You are receiving this because you are a HUBz Loyalty platform admin.",
    });

    const text = [
      "New demo request",
      `Business: ${businessName}`,
      `Contact: ${contactName}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : null,
      message ? `Message: ${message}` : null,
      "",
      `Review it: ${appUrl("/admin/demo-requests")}`,
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    await Promise.all(
      admins.map((admin) =>
        sendMail({
          kind: "DEMO_REQUEST",
          to: admin.email,
          subject: `New demo request: ${businessName}`,
          html,
          text,
        })
      )
    );

    return json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("demo request create failed", err);
    return serverError();
  }
}
