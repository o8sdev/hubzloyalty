import QRCode from "qrcode";
import { db } from "@/lib/db";
import { notFound, requireApiSession, serverError } from "@/lib/http";

export async function GET(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  try {
    // The session's businessId IS the tenant scope for this lookup.
    const business = await db.business.findUnique({
      where: { id: auth.session.businessId },
      select: { slug: true },
    });
    if (!business) return notFound("Business not found");

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const guestUrl = `${baseUrl}/r/${business.slug}`;

    const buffer = await QRCode.toBuffer(guestUrl, { width: 600, margin: 2 });

    const headers = new Headers({
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    });

    const { searchParams } = new URL(req.url);
    if (searchParams.get("download") === "1") {
      headers.set(
        "Content-Disposition",
        `attachment; filename="${business.slug}-review-qr.png"`
      );
    }

    return new Response(new Uint8Array(buffer), { status: 200, headers });
  } catch (err) {
    console.error("qr generation failed", err);
    return serverError("Could not generate QR code");
  }
}
