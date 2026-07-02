import { z } from "zod";

// ---------------------------------------------------------------------------
// Enum-like constants (SQLite has no enums; these are the source of truth,
// enforced here at the API boundary and mirrored in prisma/schema.prisma).
// ---------------------------------------------------------------------------

export const ROLES = ["OWNER", "STAFF", "ADMIN"] as const;
export const TIERS = ["BRONZE", "SILVER", "GOLD", "VIP"] as const;
export const REVIEW_STATUSES = ["NEW", "RESOLVED"] as const;
export const CUSTOMER_SOURCES = ["MANUAL", "QR", "IMPORT"] as const;

export type Tier = (typeof TIERS)[number];

/**
 * Loyalty economics: visits drive everything (no POS = no spend data).
 * Each business configures its own points-per-visit and tier thresholds
 * (columns on Business); these are the defaults for new businesses and for
 * callers that don't pass a config (e.g. the seed script).
 */
export type LoyaltyConfig = {
  pointsPerVisit: number;
  silverThreshold: number;
  goldThreshold: number;
  vipThreshold: number;
};

export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfig = {
  pointsPerVisit: 10,
  silverThreshold: 5,
  goldThreshold: 10,
  vipThreshold: 20,
};

/** @deprecated prefer business.pointsPerVisit; kept for the seed defaults. */
export const POINTS_PER_VISIT = DEFAULT_LOYALTY_CONFIG.pointsPerVisit;

export function tierForVisits(
  totalVisits: number,
  config: Pick<
    LoyaltyConfig,
    "silverThreshold" | "goldThreshold" | "vipThreshold"
  > = DEFAULT_LOYALTY_CONFIG
): Tier {
  if (totalVisits >= config.vipThreshold) return "VIP";
  if (totalVisits >= config.goldThreshold) return "GOLD";
  if (totalVisits >= config.silverThreshold) return "SILVER";
  return "BRONZE";
}

export const loyaltySettingsSchema = z
  .object({
    pointsPerVisit: z.number().int().min(0).max(10_000),
    silverThreshold: z.number().int().min(1).max(100_000),
    goldThreshold: z.number().int().min(1).max(100_000),
    vipThreshold: z.number().int().min(1).max(100_000),
  })
  .refine(
    (v) => v.silverThreshold < v.goldThreshold && v.goldThreshold < v.vipThreshold,
    { message: "Thresholds must increase: Silver < Gold < VIP" }
  );

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

// ---------------------------------------------------------------------------
// Business profile
// ---------------------------------------------------------------------------

// "" parses to null (not undefined) so clearing a saved URL in a form
// actually persists: Prisma ignores undefined but writes null.
const optionalUrl = z
  .string()
  .trim()
  .url()
  .max(500)
  .optional()
  .or(z.literal("").transform(() => null));

export const businessUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  logoUrl: optionalUrl,
  address: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .optional()
    .or(z.literal("").transform(() => null)),
  website: optionalUrl,
  googleReviewUrl: optionalUrl,
  socialLinks: z
    .object({
      instagram: z.string().trim().max(200).optional(),
      facebook: z.string().trim().max(200).optional(),
      tiktok: z.string().trim().max(200).optional(),
    })
    .optional(),
  timezone: z.string().trim().max(60).optional(),
});

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const customerCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: optionalTrimmed(80),
  phone: optionalTrimmed(40),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .optional()
    .or(z.literal("").transform(() => null)),
  // "" and null both mean "cleared". Order matters: z.coerce.date() must not
  // see null (new Date(null) is the 1970 epoch).
  birthday: z
    .union([z.literal("").transform(() => null), z.null(), z.coerce.date()])
    .optional(),
  marketingConsent: z.boolean().optional().default(false),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  notes: optionalTrimmed(2000),
});

export const customerUpdateSchema = customerCreateSchema.partial();

export const visitCreateSchema = z.object({
  amountCents: z.number().int().min(0).max(10_000_000).optional().default(0),
  note: optionalTrimmed(500),
});

export const customerListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  tier: z.enum(TIERS).optional(),
  tag: z.string().trim().max(40).optional(),
  sort: z.enum(["recent", "name", "visits", "lastVisit"]).optional().default("recent"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
});

// ---------------------------------------------------------------------------
// Reviews / feedback funnel (public + internal)
// ---------------------------------------------------------------------------

export const publicReviewCreateSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  rating: z.number().int().min(1).max(5),
});

/** Second step of the public funnel: optional comment + optional contact capture. */
export const publicReviewDetailsSchema = z.object({
  comment: optionalTrimmed(2000),
  clickedGoogle: z.boolean().optional(),
  customer: z
    .object({
      firstName: z.string().trim().min(1).max(80),
      phone: optionalTrimmed(40),
      email: z
        .string()
        .trim()
        .toLowerCase()
        .email()
        .optional()
        .or(z.literal("").transform(() => undefined)),
      birthday: z.coerce.date().optional(),
      marketingConsent: z.boolean().optional().default(false),
    })
    .optional(),
});

export const reviewUpdateSchema = z.object({
  status: z.enum(REVIEW_STATUSES),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      // strip combining diacritics left over from NFKD normalization
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "business"
  );
}

export function tagsToArray(tags: string): string[] {
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function arrayToTags(tags: string[] | undefined): string {
  return (tags ?? []).map((t) => t.trim()).filter(Boolean).join(",");
}
