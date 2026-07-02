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
  const business = await db.business.findUnique({
    where: { id: session.businessId },
  });
  if (!business) notFound();

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
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-medium">Google review link not set</p>
                <p className="mt-1">
                  Guests who leave a rating can&apos;t be offered a link to your
                  Google profile until you add your Google review link above. To
                  find it, see{" "}
                  <a
                    href="https://support.google.com/business/answer/3474122"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline hover:text-amber-900"
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
      </div>
    </div>
  );
}
