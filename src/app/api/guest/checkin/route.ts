import { z } from "zod";
import { db } from "@/lib/db";
import {
  forbidden,
  json,
  notFound,
  parseBody,
  requireApiGuestSession,
  serverError,
} from "@/lib/http";
import {
  CHECKIN_TTL_MS,
  checkEarnEligibility,
  generateUniqueCheckinCode,
} from "@/lib/checkins";
import { formatRewardCode } from "@/lib/onetime";

// A signed-in guest scans a venue's QR (which encodes /r/[slug]) → we resolve
// the business, find-or-create the guest's membership there, and mint a PENDING
// check-in. Staff confirm it at the counter (existing flow) to credit the
// visit + points. Reuses the same cooldown/cap engine as the funnel.

const checkinSchema = z.object({ slug: z.string().trim().min(1).max(80) });

function splitName(full: string): { firstName: string; lastName: string | null } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || "Guest";
  return { firstName, lastName: parts.length ? parts.join(" ") : null };
}

export async function POST(req: Request) {
  const auth = await requireApiGuestSession();
  if (auth.error) return auth.error;
  const { guestId, email, name } = auth.guest;

  const parsed = await parseBody(req, checkinSchema);
  if (parsed.error) return parsed.error;
  const slug = parsed.data.slug.toLowerCase();

  try {
    const business = await db.business.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        suspendedAt: true,
        earnCooldownHours: true,
        maxEarnPerDay: true,
      },
    });
    if (!business) return notFound("We couldn't find that place.");
    if (business.suspendedAt) return forbidden();

    // One membership per guest per business (race-safe via the compound unique).
    const { firstName, lastName } = splitName(name);
    const customer = await db.customer.upsert({
      where: { businessId_guestId: { businessId: business.id, guestId } },
      create: {
        businessId: business.id,
        guestId,
        firstName,
        lastName,
        email,
        source: "APP",
      },
      update: {},
      select: { id: true },
    });

    const eligibility = await checkEarnEligibility({
      businessId: business.id,
      customerId: customer.id,
      earnCooldownHours: business.earnCooldownHours,
      maxEarnPerDay: business.maxEarnPerDay,
    });

    if (eligibility.state === "reuse") {
      return json({
        state: "pending",
        code: formatRewardCode(eligibility.checkin.code),
        expiresAt: eligibility.checkin.expiresAt,
        businessName: business.name,
      });
    }
    if (eligibility.state === "cooldown") {
      return json({ state: "cooldown", businessName: business.name });
    }
    if (eligibility.state === "capped") {
      return json({ state: "capped", businessName: business.name });
    }

    const code = await generateUniqueCheckinCode();
    const checkin = await db.checkin.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        code,
        expiresAt: new Date(Date.now() + CHECKIN_TTL_MS),
      },
      select: { code: true, expiresAt: true },
    });
    return json({
      state: "pending",
      code: formatRewardCode(checkin.code),
      expiresAt: checkin.expiresAt,
      businessName: business.name,
    });
  } catch (err) {
    console.error("guest checkin failed", err);
    return serverError("Could not check you in — please try again");
  }
}
