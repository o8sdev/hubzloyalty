# API Design — LoyaltyCRM

REST over Next.js route handlers. JSON in/out. Four trust zones:

- **Authenticated** (`/api/*` except `public`, `auth`, `admin`, `cron`):
  requires the `lcrm_session` httpOnly JWT cookie. Handlers call
  `requireApiSession()` and scope every query by `session.businessId`. `401`
  when unauthenticated, `403` for role violations, `404` for cross-tenant ids
  (indistinguishable from missing — no existence leaks).
- **Public** (`/api/public/*`, `/api/auth/*`): unauthenticated. Business is
  resolved from a URL slug or an existing row id; the client can never supply
  a `businessId`. Rate-limited per IP (Postgres fixed-window,
  `src/lib/ratelimit.ts`, fail-open) and honeypot-guarded (`website` field —
  a value means bot; the API pretends success and writes nothing).
- **Platform admin** (`/api/admin/*`): requires the `platformAdmin` JWT claim
  (`User.isPlatformAdmin`, seeded from `ADMIN_EMAIL`/`ADMIN_PASSWORD`).
  Handlers call `requireApiPlatformAdmin()`; cross-tenant by design.
- **Cron** (`/api/cron/*`): requires `Authorization: Bearer ${CRON_SECRET}`
  (Vercel cron sends it automatically).

Validation: zod schemas in `src/lib/validation.ts` via `parseBody()`.
Errors: `{ "error": string, "details"?: fieldErrors }` with 400/401/403/404/429/500.

## Auth (Supabase Auth underneath)

Identities, credentials, session cookies and recovery emails are Supabase
Auth (`@supabase/ssr` cookies; public signups disabled project-side). The
domain `User` row (linked via `authId`) owns tenancy facts and mirrors them
into `app_metadata` (`syncAuthClaims()`), so sessions carry
businessId/role/platformAdmin/mustChangePassword without a DB read.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | — | **410-style lockout: always 403.** The app is invite-only; onboarding goes through demo requests → admin provisioning. |
| POST | `/api/auth/login` | `{ email, password }` | Supabase sign-in, sets cookies → `{ ok, admin, mustChangePassword }` (401 on bad credentials; 403 + sign-out when the business is suspended; orphan auth users are rejected). `mustChangePassword: true` routes the client to `/change-password`. Rate limit 20/15min/IP |
| POST | `/api/auth/logout` | — | Supabase sign-out, clears cookies |
| GET | `/api/auth/me` | — | `{ user, business }` (business null for platform-only accounts) |
| POST | `/api/auth/forgot` | `{ email }` | always `{ ok: true }` (no user enumeration); Supabase sends the recovery email. Rate limit 5/h/IP |
| GET | `/auth/confirm` | `?token_hash&type&next` | exchanges the emailed token for a session (verifyOtp) and redirects to `next` (same-origin only); failures land on `/forgot-password?error=expired` |
| POST | `/api/auth/reset` | `{ password }` | sets a new password for the CURRENT (recovery) session; also clears `mustChangePassword`. Rate limit 10/h/IP |
| POST | `/api/auth/change-password` | `{ currentPassword?, newPassword }` | any authenticated account (incl. platform admins). `currentPassword` (verified via a throwaway Supabase sign-in) required unless `mustChangePassword` is set; clears the flag and re-syncs claims |

## Demo requests (invite-only onboarding)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/public/demo-requests` | `{ businessName, contactName, email, phone?, message?, website? (honeypot) }` → stores the lead + emails every platform admin (kind `DEMO_REQUEST`). Rate limit 3/h/IP |
| GET | `/api/admin/demo-requests` | `?status=NEW\|CONTACTED\|CONVERTED\|DISMISSED\|all&page` → `{ requests, total, newCount }` |
| PATCH | `/api/admin/demo-requests/:id` | `{ status?, adminNotes? }` — worked by the admin; `CONVERTED` is normally set by the provisioning endpoint, not by hand |

## Business

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/business` | profile, `socialLinks` parsed to object |
| PATCH | `/api/business` | `businessUpdateSchema`; OWNER/ADMIN only (STAFF 403) |
| GET | `/api/business/qr` | PNG QR of `{APP_URL}/r/{slug}`; `?download=1` → attachment |
| PATCH | `/api/business/loyalty` | `{ pointsPerVisit, silverThreshold, goldThreshold, vipThreshold }` (Silver < Gold < VIP enforced); OWNER/ADMIN only; transactionally recomputes every customer's tier |

## Customers

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/customers` | `?q&tier&tag&sort=recent\|name\|visits\|lastVisit&page&pageSize` → `{ customers, total, page, pageSize }` |
| POST | `/api/customers` | `customerCreateSchema`, source `MANUAL` → 201 |
| GET | `/api/customers/:id` | + last 10 visits, last 10 reviews |
| PATCH | `/api/customers/:id` | partial update |
| DELETE | `/api/customers/:id` | hard delete (visits cascade, reviews unlink) |
| POST | `/api/customers/:id/visits` | `{ amountCents?, note? }` — transactionally creates Visit and updates totals/points/tier/lastVisitAt |
| GET | `/api/customers/export` | CSV attachment, all fields, RFC-4180 escaping |

## Reviews (owner inbox)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/reviews` | `?filter=all\|attention\|resolved&page` → `{ reviews, summary: { total, avgRating, googleClicks, attentionCount } }`; `attention` = `rating<=3 AND status=NEW` |
| PATCH | `/api/reviews/:id` | `{ status: "NEW"\|"RESOLVED" }` |

## Public funnel (no auth — treat as hostile input)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/public/reviews` | `{ slug, rating 1-5, website? }` → creates Review → `{ reviewId, businessName, googleReviewUrl }`. Suspended businesses 404. `rating<=3` triggers the owner complaint alert (via `after()`, deduped by `Review.alertSentAt`). Rate limit 30/h/IP |
| PATCH | `/api/public/reviews/:id` | `{ website?, comment?, clickedGoogle?, customer?: { firstName, phone?, email?, birthday?, marketingConsent } }`. Guards: review must exist and be <24h old; customer merge is scoped to the review's business (match phone, else email); consent is never downgraded by the public form; the visit/points increment fires at most once per review. Rate limit 60/h/IP |

## Platform admin (`/api/admin/*` — platformAdmin claim required)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/admin/businesses` | `{ name, slug?, owner: { name, email }, demoRequestId? }` — creates tenant + OWNER with a **server-generated one-time password** (returned once in the 201 response, never stored/logged in plaintext; owner gets `mustChangePassword`). `demoRequestId` marks the source request `CONVERTED` in the same transaction |
| PATCH | `/api/admin/businesses/:id` | any profile field + `slug`, `suspended: bool` (sets/clears `suspendedAt`), `loyalty` (runs `applyLoyaltyConfig` tier recompute), notification flags |
| DELETE | `/api/admin/businesses/:id` | deletes tenant (cascades) + its non-admin member accounts |
| POST | `/api/admin/users` | `{ name, email, password, role, businessId?, isPlatformAdmin? }`; must have a business or the admin flag |
| PATCH | `/api/admin/users/:id` | profile/role/business/password/admin flag; self-demotion blocked |
| DELETE | `/api/admin/users/:id` | self-deletion blocked |
| POST | `/api/admin/digest` | run the weekly digest immediately → `{ businesses, emailsSent, rateLimitRowsPurged }` |
| POST | `/api/admin/test-email` | `{ to }` → sends a test email, reports `SENT`/`FAILED`/`DEV_LOGGED` |

Admin UI lives at `/admin` (dark shell): overview, businesses (CRUD +
suspend/delete), users, cross-tenant review browser, email log, system
health (DB latency, env checks, digest run-now).

## Cron

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/cron/digest` | `Authorization: Bearer ${CRON_SECRET}`. Weekly owner digest for every active, opted-in business + stale rate-limit purge. Scheduled Mondays 08:00 UTC in `vercel.json` |

## Email

All sends go through `src/lib/mail.ts` (Resend REST, no SDK) and are recorded
in `EmailLog`. Without `RESEND_API_KEY` the message is printed to the console
and logged with status `DEV_LOGGED` — dev flows (reset links!) stay usable.
Kinds: `COMPLAINT_ALERT`, `WEEKLY_DIGEST`, `PASSWORD_RESET`, `DEMO_REQUEST`, `TEST`.

## Future modules (contract sketches, not yet implemented)

- **Loyalty (Phase 3):** `GET/POST /api/rewards`, `POST /api/customers/:id/redemptions` (transactional points deduction), `GET /api/customers/:id/wallet`.
- **Campaigns (Phase 4):** `GET/POST /api/campaigns`, `POST /api/campaigns/:id/activate`, `POST /api/campaigns/:id/test-send`; `POST /api/jobs/run-automations` (cron-invoked, idempotent, quiet-hours aware); inbound webhook `/api/webhooks/twilio` for STOP handling.
- **AI (Phase 5):** `POST /api/ai/suggest-reply` (draft response to a complaint), `POST /api/ai/summarize-feedback` (period summary), `POST /api/ai/campaign-copy`.
- **Analytics (Phase 6):** `GET /api/analytics/summary?from&to`, `GET /api/analytics/retention` (cohort repeat-visit rates), `GET /api/analytics/campaigns`.
