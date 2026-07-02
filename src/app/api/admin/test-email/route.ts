import { json, parseBody, requireApiPlatformAdmin, serverError } from "@/lib/http";
import { testEmailSchema } from "@/lib/validation";
import { renderEmail, sendMail } from "@/lib/mail";

/** ADMIN endpoint. Sends a test email to verify the Resend configuration. */
export async function POST(req: Request) {
  const auth = await requireApiPlatformAdmin();
  if (auth.error) return auth.error;

  const parsed = await parseBody(req, testEmailSchema);
  if (parsed.error) return parsed.error;

  try {
    const result = await sendMail({
      to: parsed.data.to,
      subject: "LoyaltyCRM test email",
      kind: "TEST",
      html: renderEmail({
        heading: "Email delivery works",
        bodyHtml:
          "<p>This is a test email sent from the LoyaltyCRM admin panel. If you can read this, outbound email is configured correctly.</p>",
      }),
      text: "This is a test email from the LoyaltyCRM admin panel.",
    });
    return json({ ok: result.ok, status: result.status });
  } catch (err) {
    console.error("test email failed", err);
    return serverError("Could not send test email");
  }
}
