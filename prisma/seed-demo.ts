/**
 * Demo seed for the guest app: listed venues (with photos), a loggable guest
 * with visits/points/tier across many of them, plus reviews. Idempotent —
 * re-running cleans the previous demo first. Run:
 *   node --env-file=.env --import tsx prisma/seed-demo.ts
 * NOT wired into `db:seed`. Leaves Test Business + the admin untouched.
 */
import { randomInt, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const GUEST_EMAIL = "guest@hubz.test";
const GUEST_PASSWORD = "guestpass1";
const GUEST_NAME = "Aylin Mammadova";

const REVIEWERS = [
  { key: "r1", name: "Leyla Rahimova", email: "leyla@reviewers.hubz.test" },
  { key: "r2", name: "Tural Aliyev", email: "tural@reviewers.hubz.test" },
  { key: "r3", name: "Aysel Guliyeva", email: "aysel@reviewers.hubz.test" },
  { key: "r4", name: "Orkhan Nabiyev", email: "orkhan@reviewers.hubz.test" },
];
const ALL_EMAILS = [GUEST_EMAIL, ...REVIEWERS.map((r) => r.email)];

// visits = the demo guest's visit count there (0 = not a member yet).
const VENUES = [
  { slug: "fjord-coffee", name: "Fjord Coffee", category: "Coffee", city: "Baku", visits: 24,
    description: "A small-batch roastery on Nizami with a quiet courtyard. Single-origin pour-overs, oat cortados, and cardamom buns baked each morning." },
  { slug: "sumaq-restaurant", name: "Sumaq Restaurant", category: "Restaurant", city: "İçərişəhər", visits: 14,
    description: "Modern Azerbaijani cooking in a restored Old City townhouse — wood-fire kebabs, saffron plov, and a rooftop for the evenings." },
  { slug: "nergiz-bakery", name: "Nərgiz Bakery", category: "Bakery", city: "Baku", visits: 11,
    description: "Family bakery by Fountains Square: tandır bread, honey cake, and sweet şəkərbura. Everything sells out by evening." },
  { slug: "cay-bagi", name: "Çay Bağı Tea Garden", category: "Coffee", city: "Baku", visits: 8,
    description: "Armudu-glass tea under the plane trees, with jam, lemon, and endless refills. The unhurried Baku afternoon, bottled." },
  { slug: "qutab-house", name: "Qutab House", category: "Restaurant", city: "Baku", visits: 6,
    description: "Griddle-fresh qutab folded to order — greens, pumpkin, or lamb — with ayran and pickles. Fast, cheap, unbeatable." },
  { slug: "bulvar-bar", name: "Bulvar Bar", category: "Bar", city: "Baku", visits: 3,
    description: "Caspian-view cocktails on the Boulevard. Local wine, nar-spiked spritzes, and a small plates menu after dark." },
  { slug: "sirin-dessert", name: "Şirin Dessert Bar", category: "Dessert", city: "Baku", visits: 0,
    description: "Pakhlava, şəkərbura, and a rotating pistachio-heavy pastry case, plus proper Azerbaijani ice cream." },
];

const REVIEWS: { slug: string; who: string; rating: number; comment: string }[] = [
  { slug: "fjord-coffee", who: "guest", rating: 5, comment: "My daily. The cortado is the best in Baku and they remember my order." },
  { slug: "fjord-coffee", who: "r1", rating: 5, comment: "Lovely courtyard, gets busy at lunch. Worth the wait." },
  { slug: "fjord-coffee", who: "r2", rating: 4, comment: "Great beans. Wish it were a touch bigger." },
  { slug: "sumaq-restaurant", who: "guest", rating: 5, comment: "Rooftop at sunset, the plov, the service — flawless every time." },
  { slug: "sumaq-restaurant", who: "r3", rating: 5, comment: "Best dinner of our trip. Book ahead." },
  { slug: "nergiz-bakery", who: "guest", rating: 4, comment: "The honey cake is unreal. Come early — it goes fast." },
  { slug: "nergiz-bakery", who: "r4", rating: 5, comment: "Warm bread all day. My kids love the şəkərbura." },
  { slug: "cay-bagi", who: "guest", rating: 4, comment: "So relaxing. Perfect for a slow afternoon with friends." },
  { slug: "cay-bagi", who: "r1", rating: 4, comment: "Charming spot, a little pricey for tea but the setting sells it." },
  { slug: "qutab-house", who: "r2", rating: 5, comment: "Cheap, fast, delicious. The pumpkin qutab is a must." },
  { slug: "bulvar-bar", who: "r3", rating: 4, comment: "Great view, decent cocktails. Gets loud on weekends." },
  { slug: "sirin-dessert", who: "r4", rating: 5, comment: "Pistachio everything. Left very happy." },
];

const POINTS_PER_VISIT = 10;
function tierFor(visits: number): string {
  if (visits >= 20) return "VIP";
  if (visits >= 10) return "GOLD";
  if (visits >= 5) return "SILVER";
  return "BRONZE";
}
const cover = (slug: string) => `https://picsum.photos/seed/${slug}-cover/800/500`;
const gallery = (slug: string, i: number) => `https://picsum.photos/seed/${slug}-${i}/600/600`;

async function ensureGuest(email: string, name: string, withAuth: boolean): Promise<string> {
  if (withAuth) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: GUEST_PASSWORD,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
    const guest = await db.guest.create({ data: { authId: data.user.id, email, name } });
    await admin.auth.admin.updateUserById(data.user.id, {
      app_metadata: { profileId: guest.id, businessId: "", role: "GUEST", platformAdmin: false, mustChangePassword: false },
    });
    return guest.id;
  }
  const guest = await db.guest.create({ data: { email, name } });
  return guest.id;
}

async function main() {
  // ---- cleanup any prior demo run
  await db.business.deleteMany({ where: { slug: { in: VENUES.map((v) => v.slug) } } });
  const prior = await db.guest.findMany({ where: { email: { in: ALL_EMAILS } }, select: { id: true, authId: true } });
  for (const g of prior) if (g.authId) await admin.auth.admin.deleteUser(g.authId).catch(() => {});
  await db.guest.deleteMany({ where: { email: { in: ALL_EMAILS } } });

  const now = Date.now();

  // ---- businesses + photos
  const bizId: Record<string, string> = {};
  for (const v of VENUES) {
    const id = randomUUID();
    bizId[v.slug] = id;
    await db.business.create({
      data: {
        id,
        name: v.name,
        slug: v.slug,
        category: v.category,
        city: v.city,
        description: v.description,
        listed: true,
        coverImageUrl: cover(v.slug),
        timezone: "Asia/Baku",
        photos: {
          create: [0, 1, 2].map((i) => ({ url: gallery(v.slug, i), position: i })),
        },
      },
    });
  }

  // ---- guests
  const guestId = await ensureGuest(GUEST_EMAIL, GUEST_NAME, true);
  const reviewerId: Record<string, string> = {};
  for (const r of REVIEWERS) reviewerId[r.key] = await ensureGuest(r.email, r.name, false);

  // ---- demo guest memberships + visit history
  const [firstName, ...rest] = GUEST_NAME.split(" ");
  const lastName = rest.join(" ") || null;
  const customerId: Record<string, string> = {};
  for (const v of VENUES) {
    if (v.visits <= 0) continue;
    const lastVisitAt = new Date(now - 4 * 86_400_000);
    const customer = await db.customer.create({
      data: {
        businessId: bizId[v.slug],
        guestId,
        firstName,
        lastName,
        email: GUEST_EMAIL,
        source: "APP",
        totalVisits: v.visits,
        loyaltyPoints: v.visits * POINTS_PER_VISIT,
        tier: tierFor(v.visits),
        lastVisitAt,
      },
      select: { id: true },
    });
    customerId[v.slug] = customer.id;
    await db.visit.createMany({
      data: Array.from({ length: v.visits }, (_, i) => ({
        businessId: bizId[v.slug],
        customerId: customer.id,
        amountCents: 0,
        pointsEarned: POINTS_PER_VISIT,
        note: "QR check-in",
        visitedAt: new Date(now - (4 + i * 6 + randomInt(0, 4)) * 86_400_000),
      })),
    });
  }

  // ---- reviews (demo guest ties to their membership; reviewers stand alone)
  for (const rv of REVIEWS) {
    const isGuest = rv.who === "guest";
    await db.review.create({
      data: {
        businessId: bizId[rv.slug],
        customerId: isGuest ? customerId[rv.slug] ?? null : null,
        guestId: isGuest ? guestId : reviewerId[rv.who],
        rating: rv.rating,
        comment: rv.comment,
        channel: "APP",
        status: rv.rating <= 3 ? "NEW" : "RESOLVED",
        createdAt: new Date(now - randomInt(1, 40) * 86_400_000),
      },
    });
  }

  // ---- a live pending check-in so the wallet shows a code
  await db.checkin.create({
    data: {
      businessId: bizId["nergiz-bakery"],
      customerId: customerId["nergiz-bakery"],
      code: "DEMO" + randomInt(10, 99),
      expiresAt: new Date(now + 2 * 60 * 60 * 1000),
    },
  });

  console.log(`Seeded ${VENUES.length} venues, ${Object.keys(customerId).length} memberships, ${REVIEWS.length} reviews.`);
  console.log(`Guest login →  ${GUEST_EMAIL}  /  ${GUEST_PASSWORD}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
