# API Design — LoyaltyCRM

REST over Next.js route handlers. JSON in/out. Two trust zones:

- **Authenticated** (`/api/*` except `public` and `auth`): requires the
  `lcrm_session` httpOnly JWT cookie. Handlers call `requireApiSession()` and
  scope every query by `session.businessId`. `401` when unauthenticated,
  `403` for role violations, `404` for cross-tenant ids (indistinguishable
  from missing — no existence leaks).
- **Public** (`/api/public/*`, `/api/auth/*`): unauthenticated. Business is
  resolved from a URL slug or an existing row id; the client can never supply
  a `businessId`.

Validation: zod schemas in `src/lib/validation.ts` via `parseBody()`.
Errors: `{ "error": string, "details"?: fieldErrors }` with 400/401/403/404/500.

## Auth

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | `{ businessName, name, email, password }` | creates Business + OWNER, sets cookie → `{ ok, businessId, slug }` |
| POST | `/api/auth/login` | `{ email, password }` | sets cookie → `{ ok }` (401 on bad credentials, same message for both failure modes) |
| POST | `/api/auth/logout` | — | clears cookie |
| GET | `/api/auth/me` | — | `{ user, business }` |

Password reset is deliberately deferred (owner-assisted during pilots); the
seam is `POST /api/auth/forgot` + Resend in Phase 2.

## Business

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/business` | profile, `socialLinks` parsed to object |
| PATCH | `/api/business` | `businessUpdateSchema`; OWNER/ADMIN only (STAFF 403) |
| GET | `/api/business/qr` | PNG QR of `{APP_URL}/r/{slug}`; `?download=1` → attachment |

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
| POST | `/api/public/reviews` | `{ slug, rating 1-5 }` → creates Review → `{ reviewId, businessName, googleReviewUrl }` |
| PATCH | `/api/public/reviews/:id` | `{ comment?, clickedGoogle?, customer?: { firstName, phone?, email?, birthday?, marketingConsent } }`. Guards: review must exist and be <24h old; customer merge is scoped to the review's business (match phone, else email); consent is never downgraded by the public form; the visit/points increment fires at most once per review. |

Known accepted gap for MVP: no rate limiting on public endpoints (a prankster
can spam ratings). Mitigation planned in Phase 2: per-IP token bucket at the
edge + review-session cookie. Documented so it's a decision, not an oversight.

## Future modules (contract sketches, not yet implemented)

- **Loyalty (Phase 3):** `GET/POST /api/rewards`, `POST /api/customers/:id/redemptions` (transactional points deduction), `GET /api/customers/:id/wallet`.
- **Campaigns (Phase 4):** `GET/POST /api/campaigns`, `POST /api/campaigns/:id/activate`, `POST /api/campaigns/:id/test-send`; `POST /api/jobs/run-automations` (cron-invoked, idempotent, quiet-hours aware); inbound webhook `/api/webhooks/twilio` for STOP handling.
- **AI (Phase 5):** `POST /api/ai/suggest-reply` (draft response to a complaint), `POST /api/ai/summarize-feedback` (period summary), `POST /api/ai/campaign-copy`.
- **Analytics (Phase 6):** `GET /api/analytics/summary?from&to`, `GET /api/analytics/retention` (cohort repeat-visit rates), `GET /api/analytics/campaigns`.
