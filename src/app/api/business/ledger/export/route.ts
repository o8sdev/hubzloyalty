import { db } from "@/lib/db";
import { requireApiSession, serverError } from "@/lib/http";

/** RFC-4180 quote + neutralize spreadsheet formula injection (guest-supplied
 *  names/notes can reach the ledger). */
function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

const HEADER = [
  "createdAt",
  "customer",
  "type",
  "delta",
  "balanceAfter",
  "valueCents",
  "sourceType",
  "staffUserId",
  "note",
];

export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  try {
    const rows = await db.pointsLedger.findMany({
      where: { businessId: auth.session.businessId },
      orderBy: { createdAt: "asc" },
      include: {
        customer: { select: { firstName: true, lastName: true } },
      },
    });

    const lines = rows.map((r) =>
      [
        r.createdAt.toISOString(),
        r.customer
          ? [r.customer.firstName, r.customer.lastName].filter(Boolean).join(" ")
          : "",
        r.type,
        String(r.delta),
        String(r.balanceAfter),
        String(r.valueCents),
        r.sourceType ?? "",
        r.createdByUserId ?? "",
        r.note ?? "",
      ]
        .map(csvField)
        .join(",")
    );

    const csv = [HEADER.join(","), ...lines].join("\n") + "\n";
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="loyalty-ledger.csv"',
      },
    });
  } catch (err) {
    console.error("ledger export failed", err);
    return serverError("Could not export the ledger");
  }
}
