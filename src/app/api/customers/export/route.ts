import { db } from "@/lib/db";
import { requireApiSession, serverError } from "@/lib/http";

/**
 * Quote a CSV field when it contains commas, quotes, or newlines, and
 * neutralize spreadsheet formula injection: guest-supplied fields (the public
 * funnel writes firstName/phone/email) starting with = + - @ tab or CR would
 * otherwise execute as formulas when the owner opens the export in Excel.
 */
function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

const HEADER = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "birthday",
  "marketingConsent",
  "totalVisits",
  "totalSpendCents",
  "loyaltyPoints",
  "tier",
  "lastVisitAt",
  "tags",
  "notes",
  "source",
  "createdAt",
];

export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  try {
    const customers = await db.customer.findMany({
      where: { businessId: auth.session.businessId },
      orderBy: { createdAt: "asc" },
    });

    const rows = customers.map((c) =>
      [
        c.firstName,
        c.lastName ?? "",
        c.phone ?? "",
        c.email ?? "",
        c.birthday ? c.birthday.toISOString().slice(0, 10) : "",
        String(c.marketingConsent),
        String(c.totalVisits),
        String(c.totalSpendCents),
        String(c.loyaltyPoints),
        c.tier,
        c.lastVisitAt ? c.lastVisitAt.toISOString() : "",
        c.tags,
        c.notes ?? "",
        c.source,
        c.createdAt.toISOString(),
      ]
        .map(csvField)
        .join(",")
    );

    const csv = [HEADER.join(","), ...rows].join("\n") + "\n";

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="customers.csv"',
      },
    });
  } catch (err) {
    console.error("customer export failed", err);
    return serverError("Could not export customers");
  }
}
