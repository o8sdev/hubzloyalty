"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";

export type SettingsFormValues = {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  googleReviewUrl: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  timezone: string;
};

export function SettingsForm({
  initial,
  canEdit,
}: {
  initial: SettingsFormValues;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<SettingsFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof SettingsFormValues>(
    key: K,
    value: SettingsFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          address: values.address,
          phone: values.phone,
          email: values.email,
          website: values.website,
          googleReviewUrl: values.googleReviewUrl,
          socialLinks: {
            instagram: values.instagram,
            facebook: values.facebook,
            tiktok: values.tiktok,
          },
          timezone: values.timezone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save changes");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="biz-name">Business name</Label>
          <Input
            id="biz-name"
            required
            minLength={2}
            maxLength={100}
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Blue Bottle Cafe"
          />
        </div>
        <div>
          <Label htmlFor="biz-phone">Phone</Label>
          <Input
            id="biz-phone"
            type="tel"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+1 555 123 4567"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="biz-address">Address</Label>
          <Input
            id="biz-address"
            value={values.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="123 Main St, Springfield"
          />
        </div>
        <div>
          <Label htmlFor="biz-email">Contact email</Label>
          <Input
            id="biz-email"
            type="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="hello@yourcafe.com"
          />
        </div>
        <div>
          <Label htmlFor="biz-website">Website</Label>
          <Input
            id="biz-website"
            type="url"
            value={values.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="https://yourcafe.com"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="biz-google">Google review URL</Label>
          <Input
            id="biz-google"
            type="url"
            value={values.googleReviewUrl}
            onChange={(e) => set("googleReviewUrl", e.target.value)}
            placeholder="https://g.page/r/XXXXXXXX/review"
          />
          <p className="mt-1 text-xs text-slate-400">
            Paste your Google review link (looks like
            https://g.page/r/.../review).
          </p>
        </div>
        <div>
          <Label htmlFor="biz-instagram">Instagram</Label>
          <Input
            id="biz-instagram"
            value={values.instagram}
            onChange={(e) => set("instagram", e.target.value)}
            placeholder="https://instagram.com/yourcafe"
          />
        </div>
        <div>
          <Label htmlFor="biz-facebook">Facebook</Label>
          <Input
            id="biz-facebook"
            value={values.facebook}
            onChange={(e) => set("facebook", e.target.value)}
            placeholder="https://facebook.com/yourcafe"
          />
        </div>
        <div>
          <Label htmlFor="biz-tiktok">TikTok</Label>
          <Input
            id="biz-tiktok"
            value={values.tiktok}
            onChange={(e) => set("tiktok", e.target.value)}
            placeholder="https://tiktok.com/@yourcafe"
          />
        </div>
        <div>
          <Label htmlFor="biz-timezone">Timezone</Label>
          <Input
            id="biz-timezone"
            value={values.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            placeholder="America/New_York"
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving || !canEdit}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {saved ? (
          <span className="text-sm font-medium text-emerald-600">Saved</span>
        ) : null}
        {!canEdit ? (
          <span className="text-sm text-slate-400">
            Only owners and admins can edit the business profile.
          </span>
        ) : null}
      </div>
    </form>
  );
}
