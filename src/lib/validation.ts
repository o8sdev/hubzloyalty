import { z } from "zod";

// ---------------------------------------------------------------------------
// Enum-like constants (SQLite has no enums; these are the source of truth,
// enforced here at the API boundary and mirrored in prisma/schema.prisma).
// ---------------------------------------------------------------------------

export const ROLES = ["OWNER", "STAFF", "ADMIN"] as const;
export const TIERS = ["BRONZE", "SILVER", "GOLD", "VIP"] as const;
export const REVIEW_STATUSES = ["NEW", "RESOLVED"] as const;
export const CUSTOMER_SOURCES = ["MANUAL", "QR", "IMPORT"] as const;

export const BUSINESS_CATEGORIES = [
  "Coffee",
  "Restaurant",
  "Bakery",
  "Bar",
  "Dessert",
  "Fast food",
  "Grocery",
  "Other",
] as const;

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

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

// The recovery session (established by the emailed /auth/confirm link)
// identifies the account; the body only carries the new password.
export const resetPasswordSchema = z.object({
  password: z.string().min(8).max(200),
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

// Base object kept separate so adminBusinessUpdateSchema can .extend() it
// (ZodEffects from .refine() has no .extend).
const businessUpdateFields = z.object({
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
  notifyComplaints: z.boolean().optional(),
  notifyWeeklyDigest: z.boolean().optional(),
  // Welcome reward (first-time funnel completers). COMPLIANCE: a signup
  // gift, never review payment — see the funnel grant logic.
  welcomeRewardEnabled: z.boolean().optional(),
  welcomeRewardText: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal("").transform(() => null)),
  welcomeRewardExpiryDays: z.number().int().min(1).max(365).optional(),
  // Visit verification policy (staff-confirmed check-ins).
  earnCooldownHours: z.number().int().min(0).max(72).optional(),
  maxEarnPerDay: z.number().int().min(1).max(10).optional(),
  askTableNumber: z.boolean().optional(),
  // Guest-app discovery listing (opt-in). Photos are handled separately via
  // /api/business/media; these are the text fields shown on the venue page.
  listed: z.boolean().optional(),
  category: z.string().trim().max(40).optional().or(z.literal("").transform(() => null)),
  description: z.string().trim().max(600).optional().or(z.literal("").transform(() => null)),
  city: z.string().trim().max(80).optional().or(z.literal("").transform(() => null)),
});

/** Owner invites a staff member (OTP provisioning, like admin onboarding). */
export const teamInviteSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
});

export const businessUpdateSchema = businessUpdateFields.refine(
  (v) =>
    v.welcomeRewardEnabled !== true ||
    (typeof v.welcomeRewardText === "string" && v.welcomeRewardText.length >= 3),
  {
    message: "Describe the reward (at least 3 characters) before enabling it",
    path: ["welcomeRewardText"],
  }
);

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
  source: z.enum(CUSTOMER_SOURCES).optional(),
  consent: z.enum(["yes", "no"]).optional(),
  // "1" = only guests who asked for a complaint callback (tag-backed).
  callback: z.literal("1").optional(),
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
  // Honeypot: hidden form field real guests never fill. A value here means
  // a bot; the API pretends success and drops the submission.
  website: z.string().max(200).optional(),
});

/** Second step of the public funnel: optional comment + optional contact capture. */
export const publicReviewDetailsSchema = z.object({
  // Honeypot (see publicReviewCreateSchema).
  website: z.string().max(200).optional(),
  // Waiter venues: self-reported table number, verified by the human who
  // confirms the check-in.
  tableNumber: optionalTrimmed(10),
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

// ---------------------------------------------------------------------------
// Platform admin (/api/admin/*)
// ---------------------------------------------------------------------------

const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only")
  .min(2)
  .max(60);

// Invite-only onboarding: the server GENERATES a one-time password for the
// owner (returned once in the API response); the admin never types one.
export const adminBusinessCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: slugField.optional(),
  owner: z.object({
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().toLowerCase().email(),
  }),
  // When converting a demo request: marked CONVERTED in the same transaction.
  demoRequestId: z.string().trim().min(1).optional(),
});

export const adminBusinessUpdateSchema = businessUpdateFields
  .extend({
    slug: slugField.optional(),
    suspended: z.boolean().optional(),
    // Max STAFF members the owner may invite (platform-admin controlled).
    staffLimit: z.number().int().min(0).max(1000).optional(),
    // Loyalty changes go through applyLoyaltyConfig (bulk tier recompute).
    loyalty: loyaltySettingsSchema.optional(),
  })
  .refine(
    (v) =>
      v.welcomeRewardEnabled !== true ||
      (typeof v.welcomeRewardText === "string" && v.welcomeRewardText.length >= 3),
    {
      message: "Describe the reward (at least 3 characters) before enabling it",
      path: ["welcomeRewardText"],
    }
  );

export const adminUserCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
  role: z.enum(ROLES).optional().default("STAFF"),
  businessId: z.string().trim().min(1).nullable().optional(),
  isPlatformAdmin: z.boolean().optional().default(false),
});

export const adminUserUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  role: z.enum(ROLES).optional(),
  businessId: z.string().trim().min(1).nullable().optional(),
  password: z.string().min(8).max(200).optional(),
  isPlatformAdmin: z.boolean().optional(),
});

export const testEmailSchema = z.object({
  to: z.string().trim().toLowerCase().email(),
});

// ---------------------------------------------------------------------------
// Audit log queries
// ---------------------------------------------------------------------------

/** Owner Activity page: their own business's actions, filter by member+date. */
export const activityQuerySchema = z.object({
  actorUserId: z.string().trim().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(30),
});

/** Admin Activity page: all businesses, richer filters. */
export const adminActivityQuerySchema = z.object({
  q: z.string().trim().max(200).optional(), // matches actorEmail / summary
  businessId: z.string().trim().min(1).optional(),
  action: z.string().trim().max(60).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
});

// ---------------------------------------------------------------------------
// Demo requests (invite-only onboarding: the public "register" replacement)
// ---------------------------------------------------------------------------

export const DEMO_REQUEST_STATUSES = [
  "NEW",
  "CONTACTED",
  "CONVERTED",
  "DISMISSED",
] as const;

export const demoRequestCreateSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  contactName: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  phone: optionalTrimmed(40),
  message: optionalTrimmed(1000),
  // Honeypot (see publicReviewCreateSchema).
  website: z.string().max(200).optional(),
});

export const demoRequestUpdateSchema = z
  .object({
    // CONVERTED is set exclusively by the business-provisioning transaction
    // (with convertedBusinessId); it cannot be entered or left via PATCH.
    status: z.enum(["NEW", "CONTACTED", "DISMISSED"]).optional(),
    adminNotes: optionalTrimmed(2000),
  })
  .refine((v) => v.status !== undefined || v.adminNotes !== undefined, {
    message: "Nothing to update",
  });

// ---------------------------------------------------------------------------
// Account (own password)
// ---------------------------------------------------------------------------

// currentPassword is optional at the schema level: it is NOT required while
// the account still has mustChangePassword set (the user just proved the
// one-time password at login); the API enforces it for voluntary changes.
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200).optional(),
  newPassword: z.string().min(8).max(200),
});
