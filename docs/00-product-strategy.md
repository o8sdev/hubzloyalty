# Product Strategy — LoyaltyCRM

*CTO assessment, July 2026. Informed by a four-lens critique panel (skeptic VC,
competitive analyst, cafe-owner persona, MVP-scope review) run before any code
was written.*

## 1. Product critique — what's wrong with the original brief

**The one critical flaw: the review funnel as specified is illegal-adjacent.**
"IF rating >= 4 → send to Google; IF rating <= 3 → keep it private" is
**review gating**. It explicitly violates Google Business Profile policy
(selectively soliciting positive reviews) and the FTC's 2024 Rule on Consumer
Reviews and Testimonials (16 CFR Part 465, penalties ~$50k+/violation).
Podium and Birdeye were forced to remove exactly this feature years ago.
Getting a pilot cafe's Google listing review-purged would destroy the one
metric we sell. **Decision: the funnel is ungated.** Every guest, at every
rating, sees both the Google review option and the private "message the owner"
option. Emphasis adapts to the rating (low ratings see the private form first),
but nothing is hidden and no rating conditions the ask. We also never award
points for reviews (banned as incentivized reviews) — points attach to the
*visit*, not the review. Compliance becomes a selling point, not a liability.

**Second flaw: the phasing was inverted.** The original plan ships auth +
business profile + CRM first and the review system second. But an empty CRM
delivers zero value to a cafe owner; the QR review funnel delivers a countable
outcome (Google review count, complaints intercepted) in week one *and* fills
the CRM as a byproduct. We flipped it: the funnel ships in Phase 1.

**Third flaw: "total spend" has no data source.** Without POS integration,
nobody at a busy counter keys in transaction amounts. Visit frequency via
repeat QR scans is the honest signal. Spend stays in the schema (staff can log
it manually for regulars) but nothing important depends on it.

**Fourth: role-based access is over-engineered for a 2-staff cafe.** Roles
exist in the data model (OWNER/STAFF/ADMIN, cheap now, painful to retrofit)
but there is no role-management UI in the MVP.

**Fifth: "AI" is table stakes, not a moat.** Every incumbent already claims AI
copy generation and churn scores. Churn-risk detection is meaningless until
months of visit data exist. AI features stay in Phase 5, and the first one
worth building is *suggested replies to private complaints* — the only one
that saves the owner real time.

## 2. Market validation assessment

**Verdict: crowded category, real whitespace, brutal distribution.**

- **Incumbent map** (researched July 2026): Birdeye ($299–449/location/mo) and
  Podium ($399–599/mo + setup fees) are priced for multi-location; Ovation and
  Tattle sell to restaurant groups; Stamp Me (~$49/mo) and Loopy Loyalty
  ($25–95/mo) do stamps only; Marsello ($60–120/mo) and TapMango (quote-only)
  need POS/ecommerce hookups; Como/Punchh/SevenRooms are enterprise. **Nobody
  credibly owns "review funnel + loyalty + winback in one cheap tool for
  single-location independents."**
- **The credible differentiators** are *not* AI: (a) no POS dependency —
  QR-at-table capture works for cash-heavy independents; (b) WhatsApp-first
  automation — US incumbents are SMS-centric, so WhatsApp-dominant geographies
  (Europe, MENA, LatAm, SE Asia) are the most defensible beachhead; (c)
  transparent self-serve pricing — incumbents hide pricing behind demo calls.
- **Pricing the market supports:** free/€19 entry (QR funnel + basic CRM,
  capped contacts) as the acquisition wedge; €49–79/mo core (loyalty +
  winback + birthday automations with included message credits); €99–149/mo
  pro (WhatsApp campaigns, multi-location, AI). Above ~€150 we compete with
  Marsello/TapMango on features and lose. Messaging costs must be credit-capped
  or passed through — a 2,000-contact list can burn $50–100/mo in SMS COGS.
- **The honest risks** (accept them consciously): SMB restaurant churn is
  structural (~20% of restaurants close yearly; expect 4–5%/mo logo churn);
  CAC via cold outbound will exceed LTV — this business needs a channel
  (agency resellers, franchise groups, a local-market referral loop) or it
  stays a lifestyle business. That is a distribution problem to solve during
  pilots, not a reason to skip them.
- **Validation gate before scaling spend:** 3–5 *paid* pilots (~€49–149/mo, no
  free pilots — free tells you nothing) in one city; success = each owner can
  read a monthly statement like *"+28 Google reviews, 3 complaints handled
  privately, 19 lapsed customers returned"* and renews without being chased.

## 3. MVP scope reduction

The wedge: **QR review funnel with complaint interception and contact
capture.** It proves value in week one, needs no messaging-channel approvals,
no POS, no cron — and every scan builds the customer database that justifies
the rest of the roadmap.

| Decision | What we do |
| --- | --- |
| **Build now (Phase 1)** | Auth (email+password, single business per account), business profile + Google review link, QR code generation, public review funnel (ungated), private feedback inbox, customer CRM (auto-filled by the funnel; manual add/edit/CSV export), visit logging, minimal dashboard |
| **Concierge (don't build yet)** | Winback/birthday sends: export CSV, send via WhatsApp Business App by hand during pilots — validates copy, timing, redemption before we write a scheduler. Feedback summaries: written by hand weekly. |
| **Deferred with explicit triggers** | Campaign engine → when manually sending >50 msgs/week with >5% redemption. Loyalty rewards/redemption UI → when ≥2 pilot owners ask unprompted. Roles UI + team management → >5 paying venues. Analytics dashboard → owners ask questions the daily email can't answer. AI features → concierge versions consumed weekly. POS integration → a paying customer makes it a renewal condition. |
| **Killed from MVP** | Password reset email flow (owner-assisted for pilots), staff roles UI, spend-based loyalty math, customer wallet, n8n integration |
| **Start on day 1 (paperwork, not code)** | Meta Business verification + WhatsApp template pre-approval; SMS sender/A2P registration in the target market. These take 1–4+ weeks and must be ready when the campaign-engine trigger fires. |

**Owner-experience principle** (from the persona review): the owner will not
log into a dashboard weekly. The long-term primary surface is a **weekly
digest + real-time complaint notifications** (email in Phase 2, WhatsApp
later); the dashboard is the secondary drill-down surface. Phase 1 ships the
dashboard because notifications need infrastructure; the digest is the very
next thing (Phase 2).

**Compliance posture from day 1:** ungated funnel (above); marketing consent
is opt-in only, captured with explicit copy, never downgraded silently, and
consent state is visible on every customer record. Before any automated
messaging ships (Phase 4): immutable consent logs (timestamp, IP, exact
wording), automated STOP handling, quiet hours, per-channel consent.
