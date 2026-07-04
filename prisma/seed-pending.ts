/**
 * One-off, tenant-scoped seed: 50 guests each with a PENDING check-in for the
 * Test Business (owner rhabibli@outlook.com) — the "waiting to be confirmed"
 * queue the owner/staff clear at the counter.
 *
 * Run:  npx tsx prisma/seed-pending.ts
 *
 * NOT wired into `db:seed` on purpose (that one resets the admin password).
 * Everything is scoped to the one business; nothing else is touched. Each
 * guest is tagged in `notes` with a marker so this batch is easy to remove.
 */
import { randomInt, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { tierForVisits } from "../src/lib/validation";

const prisma = new PrismaClient();

const OWNER_EMAIL = "rhabibli@outlook.com";
const COUNT = 50;
const SEED_MARKER = "[seed:pending] demo check-in — safe to delete";

// Unambiguous bearer-code alphabet (mirrors src/lib/onetime.ts): no 0/O, 1/I/L.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const codeOf = () =>
  Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const FIRST = [
  "Aylin", "Kenan", "Leyla", "Murad", "Nigar", "Rashad", "Sabina", "Tural",
  "Ulviyya", "Vusal", "Zaur", "Gunel", "Elvin", "Fidan", "Orkhan", "Sevil",
  "Emin", "Lala", "Ramin", "Konul", "Anar", "Nardana", "Farid", "Aysel",
  "Ibrahim", "Maya", "Omar", "Sofia", "Liam", "Noor", "Elena", "Hasan",
  "Diana", "Yusif", "Camilla", "Toghrul", "Nərmin", "Kamran", "Aida", "Cavid",
];
const LAST = [
  "Aliyev", "Mammadov", "Hüseynov", "Quliyev", "Rzayev", "Ismayilov",
  "Əliyeva", "Hasanov", "Nabiyev", "Sultanova", "Kərimli", "Abbasov",
  "Cəfərov", "Musayeva", "Bayramov", "Vəliyev", "", "", "", "",
];

function pick<T>(arr: readonly T[]): T {
  return arr[randomInt(arr.length)];
}

async function main() {
  const owner = await prisma.user.findFirst({
    where: { email: { equals: OWNER_EMAIL, mode: "insensitive" } },
    select: { businessId: true },
  });
  if (!owner?.businessId) {
    throw new Error(`No business found for owner ${OWNER_EMAIL}`);
  }

  const business = await prisma.business.findUnique({
    where: { id: owner.businessId },
    select: {
      id: true,
      name: true,
      pointsPerVisit: true,
      silverThreshold: true,
      goldThreshold: true,
      vipThreshold: true,
    },
  });
  if (!business) throw new Error("Business row missing");
  const loyalty = {
    pointsPerVisit: business.pointsPerVisit,
    silverThreshold: business.silverThreshold,
    goldThreshold: business.goldThreshold,
    vipThreshold: business.vipThreshold,
  };

  // Reserve 50 unique codes that don't collide with anything already issued.
  const [existingCheckins, existingClaims] = await Promise.all([
    prisma.checkin.findMany({ select: { code: true } }),
    prisma.rewardClaim.findMany({ select: { code: true } }),
  ]);
  const taken = new Set<string>([
    ...existingCheckins.map((c) => c.code),
    ...existingClaims.map((c) => c.code),
  ]);
  const codes: string[] = [];
  while (codes.length < COUNT) {
    const c = codeOf();
    if (!taken.has(c)) {
      taken.add(c);
      codes.push(c);
    }
  }

  const now = Date.now();
  const TWO_HOURS = 2 * 60 * 60 * 1000;

  const customers: Array<Record<string, unknown>> = [];
  const checkins: Array<Record<string, unknown>> = [];

  for (let i = 0; i < COUNT; i++) {
    const customerId = randomUUID();
    // Newest first: trickled in over the last ~100 minutes, +/- a little jitter.
    const createdAt = new Date(now - i * 120_000 - randomInt(0, 60_000));
    // Faithful to the real 2h TTL — still valid because createdAt is recent.
    const expiresAt = new Date(createdAt.getTime() + TWO_HOURS);

    // ~40% are returning guests with prior confirmed visits; the rest are
    // first-time scanners (0 visits) minting their very first check-in.
    const priorVisits = randomInt(0, 10) < 4 ? randomInt(1, 9) : 0;
    const firstName = pick(FIRST);
    const lastName = pick(LAST) || null;

    customers.push({
      id: customerId,
      businessId: business.id,
      firstName,
      lastName,
      phone: `+994 ${50 + randomInt(0, 5)} ${100 + randomInt(0, 900)} ${10 + randomInt(0, 90)} ${10 + randomInt(0, 90)}`,
      marketingConsent: randomInt(0, 10) < 6,
      totalVisits: priorVisits,
      loyaltyPoints: priorVisits * loyalty.pointsPerVisit,
      tier: tierForVisits(priorVisits, loyalty),
      lastVisitAt: priorVisits > 0 ? new Date(now - randomInt(1, 30) * 86_400_000) : null,
      source: "QR",
      notes: SEED_MARKER,
      createdAt,
      updatedAt: createdAt,
    });

    checkins.push({
      id: randomUUID(),
      businessId: business.id,
      customerId,
      code: codes[i],
      // ~45% waiter venues (self-reported table); the rest counter pickup.
      tableNumber: randomInt(0, 100) < 45 ? String(randomInt(1, 25)) : null,
      status: "PENDING",
      expiresAt,
      createdAt,
    });
  }

  await prisma.customer.createMany({ data: customers as never });
  await prisma.checkin.createMany({ data: checkins as never });

  console.log(
    `Seeded ${COUNT} pending check-ins for "${business.name}" (${business.id}).`
  );
  console.log(`Sample codes: ${codes.slice(0, 5).map((c) => `${c.slice(0, 3)}-${c.slice(3)}`).join(", ")}`);
  console.log(`Cleanup later: delete guests whose notes = "${SEED_MARKER}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
