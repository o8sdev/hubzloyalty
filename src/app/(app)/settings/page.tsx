import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import {
  Card,
  CardBody,
  CardHeader,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { SettingsForm } from "./settings-form";
import { LoyaltyForm } from "./loyalty-form";
import { NotificationsForm } from "./notifications-form";
import { WelcomeRewardForm } from "./welcome-reward-form";
import { VisitVerificationForm } from "./visit-verification-form";
import { VenueListing } from "./venue-listing";
import { TeamCard } from "./team-card";
import { ChangePasswordForm } from "@/components/change-password-form";

type SocialLinks = { instagram?: string; facebook?: string; tiktok?: string };

/** Parse the socialLinks JSON string column into an object (null-safe). */
function parseSocialLinks(raw: string | null): SocialLinks {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const obj = parsed as Record<string, unknown>;
    return {
      instagram: typeof obj.instagram === "string" ? obj.instagram : undefined,
      facebook: typeof obj.facebook === "string" ? obj.facebook : undefined,
      tiktok: typeof obj.tiktok === "string" ? obj.tiktok : undefined,
    };
  } catch {
    return {};
  }
}

export default async function SettingsPage() {
  const session = await requireSession();
  const [business, members] = await Promise.all([
    db.business.findUnique({
      where: { id: session.businessId },
      include: {
        photos: { orderBy: { position: "asc" }, select: { id: true, url: true } },
      },
    }),
    db.user.findMany({
      where: { businessId: session.businessId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, email: true, role: true },
    }),
  ]);
  if (!business) notFound();

  const teamMembers = members.map((m) => ({
    ...m,
    isSelf: m.id === session.userId,
  }));

  const social = parseSocialLinks(business.socialLinks);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const guestUrl = `${baseUrl}/r/${business.slug}`;
  const canEdit = session.role === "OWNER" || session.role === "ADMIN";

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Your business profile and review QR code."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Business profile"
            description="Shown to guests on your public review page."
          />
          <CardBody>
            <SettingsForm
              canEdit={canEdit}
              initial={{
                name: business.name,
                address: business.address ?? "",
                phone: business.phone ?? "",
                email: business.email ?? "",
                website: business.website ?? "",
                googleReviewUrl: business.googleReviewUrl ?? "",
                instagram: social.instagram ?? "",
                facebook: social.facebook ?? "",
                tiktok: social.tiktok ?? "",
                timezone: business.timezone,
              }}
            />
          </CardBody>
        </Card>

        {canEdit ? (
          <Card>
            <CardHeader
              title="Venue listing & photos"
              description="Your page in the guest app's Discover directory — opt in, add photos, and describe your place."
            />
            <CardBody>
              <VenueListing
                initial={{
                  listed: business.listed,
                  category: business.category ?? "",
                  description: business.description ?? "",
                  city: business.city ?? "",
                  coverImageUrl: business.coverImageUrl,
                  logoUrl: business.logoUrl,
                  photos: business.photos,
                }}
              />
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader
            title="Loyalty program"
            description="How your customers earn points and climb tiers. Every business sets its own rules."
          />
          <CardBody>
            <LoyaltyForm
              canEdit={canEdit}
              initial={{
                pointsPerVisit: business.pointsPerVisit,
                silverThreshold: business.silverThreshold,
                goldThreshold: business.goldThreshold,
                vipThreshold: business.vipThreshold,
              }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Check-in rules"
            description="Points credit only when you or your staff confirm a guest's code — these rules bound how often codes can be created."
          />
          <CardBody>
            <VisitVerificationForm
              canEdit={canEdit}
              initial={{
                earnCooldownHours: business.earnCooldownHours,
                maxEarnPerDay: business.maxEarnPerDay,
                askTableNumber: business.askTableNumber,
              }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Team"
            description="Who can confirm guest codes at the counter."
          />
          <CardBody>
            <TeamCard
              canEdit={canEdit}
              members={teamMembers}
              staffLimit={business.staffLimit}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Welcome reward"
            description="A one-time gift that gets first-time guests to scan, join your list, and come back to claim it."
          />
          <CardBody>
            <WelcomeRewardForm
              canEdit={canEdit}
              initial={{
                welcomeRewardEnabled: business.welcomeRewardEnabled,
                welcomeRewardText: business.welcomeRewardText ?? "",
                welcomeRewardExpiryDays: business.welcomeRewardExpiryDays,
                welcomeRewardValueCents: business.welcomeRewardValueCents,
              }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Notifications"
            description="Which emails you and your admins receive."
          />
          <CardBody>
            <NotificationsForm
              canEdit={canEdit}
              initial={{
                notifyComplaints: business.notifyComplaints,
                notifyWeeklyDigest: business.notifyWeeklyDigest,
              }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Your review QR code"
            description="Print it and place it on tables, receipts, or the counter so guests can rate their visit."
          />
          <CardBody>
            {!business.googleReviewUrl ? (
              <div className="mb-4 rounded-lg border border-ink/15 bg-paper-deep/50 px-4 py-3 text-sm text-ink-soft">
                <p className="font-medium">Google review link not set</p>
                <p className="mt-1">
                  Guests who leave a rating can&apos;t be offered a link to your
                  Google profile until you add your Google review link above. To
                  find it, see{" "}
                  <a
                    href="https://support.google.com/business/answer/3474122"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline hover:text-ink"
                  >
                    Google&apos;s official instructions
                  </a>
                  : Google Business Profile → Ask for reviews → copy the short
                  link.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/api/business/qr"
                alt={`QR code linking to the review page for ${business.name}`}
                width={160}
                height={160}
                className="h-40 w-40 rounded-lg border border-slate-200 bg-white p-2"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700">Guest URL</p>
                <p className="mt-1 break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700 select-all">
                  {guestUrl}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Click the link to select it, then copy.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <LinkButton href="/api/business/qr?download=1" prefetch={false}>
                    Download QR (PNG)
                  </LinkButton>
                  <LinkButton
                    variant="secondary"
                    href={`/r/${business.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Preview guest page
                  </LinkButton>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Account"
            description={`Change the password for ${session.email}.`}
          />
          <CardBody>
            <ChangePasswordForm requireCurrent={true} redirectTo="/settings" />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
