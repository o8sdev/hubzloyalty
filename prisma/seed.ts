// Demo seed data for LoyaltyCRM.
// Run with: npx tsx prisma/seed.ts
//
// Idempotent: deletes and recreates the "demo-cafe" business (cascades wipe
// its customers/visits/reviews) plus the demo owner user, then reseeds.
// All randomness is deterministic (mulberry32 seeded with 42) so repeated
// runs produce identical data.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { tierForVisits, POINTS_PER_VISIT } from "../src/lib/validation";

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_SLUG = "demo-cafe";
const DEMO_EMAIL = "demo@loyaltycrm.test";
const DEMO_PASSWORD = "demo1234";

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — do not use Math.random.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

/** Integer in [min, max] inclusive. */
function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

/** True with probability p (0..1). */
function chance(p: number): boolean {
  return rand() < p;
}

// ---------------------------------------------------------------------------
// Data pools
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "Olivia", "Liam", "Emma", "Noah", "Ava", "Ethan", "Sofia", "Mason",
  "Isabella", "Lucas", "Mia", "James", "Amelia", "Benjamin", "Harper",
  "Elijah", "Charlotte", "Daniel", "Evelyn", "Henry", "Layla", "Alexander",
  "Zoe", "Sebastian", "Nora", "Jack", "Priya", "Mateo", "Yuki", "Omar",
] as const;

const LAST_NAMES = [
  "Smith", "Johnson", "Garcia", "Chen", "Martinez", "Brown", "Davis",
  "Nguyen", "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Patel",
  "Kim", "Lopez", "White", "Harris", "Clark", "Lewis", "Walker", "Hall",
  "Young", "Ali", "King", "Wright", "Scott", "Torres", "Baker", "Reed",
] as const;

const TAG_POOL = ["regular", "weekend", "oat-milk", "student"] as const;

const CUSTOMER_NOTES = [
  "Prefers oat milk, always extra hot.",
  "Comes in with the office crew on Fridays.",
  "Allergic to nuts — double-check pastries.",
  "Asked about catering for a birthday party.",
  "Usually orders the seasonal special.",
] as const;

const COMPLAINT_COMMENTS = [
  "Waited almost 25 minutes for two lattes and nobody even acknowledged us.",
  "My sandwich came out cold and the order was wrong — twice.",
  "Coffee was fine but the person at the register was really rude during the morning rush.",
  "Ordered oat milk, got regular. When I mentioned it the barista rolled their eyes.",
  "Table was sticky and the food took forever. Lunch hour here is chaos.",
  "Asked for decaf, pretty sure that wasn't decaf. Wrong order again.",
  "Music way too loud and my croissant was stale.",
  "Staff seemed completely overwhelmed at rush hour — waited 20 minutes then gave up.",
] as const;

const PRAISE_COMMENTS = [
  "Best flat white in the neighborhood — the staff remembers my order!",
  "Cozy spot, fast service even when it's packed. Love it.",
  "The seasonal menu is fantastic and the team is so friendly.",
  "My daily stop before work. Never disappoints.",
] as const;

// ---------------------------------------------------------------------------
// Seed steps
// ---------------------------------------------------------------------------

async function resetDemoData(): Promise<void> {
  const existing = await prisma.business.findUnique({
    where: { slug: DEMO_SLUG },
    select: { id: true },
  });
  if (existing) {
    // Cascades remove customers, visits, reviews, rewards, campaigns.
    await prisma.business.delete({ where: { id: existing.id } });
  }
  // User is onDelete: SetNull, so remove it explicitly if still around.
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });
}

async function main(): Promise<void> {
  await resetDemoData();

  const now = Date.now();

  // --- Business + owner -----------------------------------------------------
  const business = await prisma.business.create({
    data: {
      name: "Demo Cafe",
      slug: DEMO_SLUG,
      address: "42 Roastery Lane, Portland, OR 97204",
      phone: "+1 503 555 0142",
      email: "hello@democafe.test",
      website: "https://democafe.test",
      googleReviewUrl: "https://g.page/r/DEMO-not-a-real-link/review",
      socialLinks: JSON.stringify({ instagram: "@demo.cafe" }),
      timezone: "America/Los_Angeles",
    },
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash,
      name: "Demo Owner",
      role: "OWNER",
      businessId: business.id,
    },
  });

  // --- Platform admin ---------------------------------------------------------
  // The systems-admin account for /admin. Credentials come from env so real
  // deploys never ship a default password. Upsert keeps an existing admin's
  // password when ADMIN_PASSWORD is unset.
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@loyaltycrm.test";
  const adminPassword = process.env.ADMIN_PASSWORD;
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });
  if (!existingAdmin && !adminPassword) {
    throw new Error(
      "ADMIN_PASSWORD must be set in .env to create the platform admin account"
    );
  }
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword!, 10),
      name: "Platform Admin",
      role: "ADMIN",
      isPlatformAdmin: true,
    },
    update: {
      isPlatformAdmin: true,
      ...(adminPassword
        ? { passwordHash: await bcrypt.hash(adminPassword, 10) }
        : {}),
    },
  });

  // --- Customers ------------------------------------------------------------
  const customerCount = 30;
  const customerIds: string[] = [];
  let totalVisitsCreated = 0;

  for (let i = 0; i < customerCount; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(i * 7 + randInt(0, 4)) % LAST_NAMES.length];
    const source = chance(0.5) ? "QR" : "MANUAL";

    // Spread sign-ups over the past 120 days.
    const createdAtMs = now - randInt(0, 120) * DAY_MS - randInt(0, DAY_MS - 1);
    const createdAt = new Date(createdAtMs);

    const tags: string[] = [];
    for (const tag of TAG_POOL) {
      if (chance(0.2)) tags.push(tag);
    }

    const customer = await prisma.customer.create({
      data: {
        businessId: business.id,
        firstName,
        lastName,
        phone: chance(0.8) ? `+1503555${String(randInt(1000, 9999))}` : null,
        email: chance(0.5)
          ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`
          : null,
        birthday: chance(0.4)
          ? new Date(Date.UTC(1975 + randInt(0, 30), randInt(0, 11), randInt(1, 28)))
          : null,
        marketingConsent: chance(0.7),
        tags: tags.join(","),
        notes: chance(0.15) ? pick(CUSTOMER_NOTES) : null,
        source,
        createdAt,
      },
    });
    customerIds.push(customer.id);

    // --- Visits for this customer -------------------------------------------
    const visitCount = randInt(0, 25);
    let totalSpendCents = 0;
    let lastVisitMs = 0;
    const visitRows: {
      businessId: string;
      customerId: string;
      amountCents: number;
      pointsEarned: number;
      visitedAt: Date;
    }[] = [];

    for (let v = 0; v < visitCount; v++) {
      const visitedAtMs =
        createdAtMs + Math.floor(rand() * Math.max(1, now - createdAtMs));
      const amountCents = source === "QR" ? 0 : randInt(400, 2500);
      totalSpendCents += amountCents;
      if (visitedAtMs > lastVisitMs) lastVisitMs = visitedAtMs;
      visitRows.push({
        businessId: business.id,
        customerId: customer.id,
        amountCents,
        pointsEarned: POINTS_PER_VISIT,
        visitedAt: new Date(visitedAtMs),
      });
    }

    if (visitRows.length > 0) {
      await prisma.visit.createMany({ data: visitRows });
    }
    totalVisitsCreated += visitCount;

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        totalVisits: visitCount,
        loyaltyPoints: visitCount * POINTS_PER_VISIT,
        totalSpendCents,
        lastVisitAt: visitCount > 0 ? new Date(lastVisitMs) : null,
        tier: tierForVisits(visitCount),
      },
    });
  }

  // --- Reviews ----------------------------------------------------------------
  // ~45 reviews over the past 60 days: 20x5, 12x4, 6x3, 4x2, 3x1.
  const ratingPlan: number[] = [
    ...Array<number>(20).fill(5),
    ...Array<number>(12).fill(4),
    ...Array<number>(6).fill(3),
    ...Array<number>(4).fill(2),
    ...Array<number>(3).fill(1),
  ];

  let reviewCount = 0;
  for (const rating of ratingPlan) {
    const createdAt = new Date(now - Math.floor(rand() * 60 * DAY_MS));
    const isHappy = rating >= 4;

    let comment: string | null = null;
    if (!isHappy && chance(0.7)) comment = pick(COMPLAINT_COMMENTS);
    if (rating === 5 && chance(0.2)) comment = pick(PRAISE_COMMENTS);

    await prisma.review.create({
      data: {
        businessId: business.id,
        customerId: chance(0.6) ? pick(customerIds) : null,
        rating,
        comment,
        clickedGoogle: isHappy && chance(0.6),
        status: !isHappy && chance(0.5) ? "RESOLVED" : "NEW",
        createdAt,
      },
    });
    reviewCount++;
  }

  console.log("Seed complete.");
  console.log(`  Business:  ${business.name} (slug: ${business.slug})`);
  console.log(`  Customers: ${customerIds.length}`);
  console.log(`  Visits:    ${totalVisitsCreated}`);
  console.log(`  Reviews:   ${reviewCount}`);
  console.log("");
  console.log("Demo login:");
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log("");
  console.log(`Platform admin: ${admin.email} (password from ADMIN_PASSWORD in .env)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
