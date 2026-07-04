"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";

// ---------------------------------------------------------------------------
// Client widgets for the admin business detail page: edit form, loyalty
// form, suspend toggle, delete (typed confirmation).
// ---------------------------------------------------------------------------

type BusinessInitial = {
  id: string;
  name: string;
  slug: string;
  googleReviewUrl: string;
  timezone: string;
  notifyComplaints: boolean;
  notifyWeeklyDigest: boolean;
  staffLimit: number;
};

export function AdminBusinessEditForm({ initial }: { initial: BusinessInitial }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [googleReviewUrl, setGoogleReviewUrl] = useState(initial.googleReviewUrl);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [notifyComplaints, setNotifyComplaints] = useState(initial.notifyComplaints);
  const [notifyWeeklyDigest, setNotifyWeeklyDigest] = useState(
    initial.notifyWeeklyDigest
  );
  const [staffLimit, setStaffLimit] = useState(String(initial.staffLimit));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const staffLimitNum = Number(staffLimit);
    if (!Number.isInteger(staffLimitNum) || staffLimitNum < 0 || staffLimitNum > 1000) {
      setError("Staff limit must be a whole number between 0 and 1000");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/businesses/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          googleReviewUrl,
          timezone,
          notifyComplaints,
          notifyWeeklyDigest,
          staffLimit: staffLimitNum,
        }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save changes");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ab-name">Name</Label>
          <Input
            id="ab-name"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="ab-slug">Slug</Label>
          <Input
            id="ab-slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="ab-google">Google review URL</Label>
          <Input
            id="ab-google"
            type="url"
            value={googleReviewUrl}
            onChange={(e) => setGoogleReviewUrl(e.target.value)}
            placeholder="https://g.page/r/…/review"
          />
        </div>
        <div>
          <Label htmlFor="ab-tz">Timezone</Label>
          <Input
            id="ab-tz"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="ab-staff">Staff limit</Label>
          <Input
            id="ab-staff"
            type="number"
            min={0}
            max={1000}
            step={1}
            value={staffLimit}
            onChange={(e) => setStaffLimit(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400">
            Max staff the owner can invite (owner not counted). New businesses
            start at 1.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={notifyComplaints}
            onChange={(e) => setNotifyComplaints(e.target.checked)}
            className="h-4 w-4 accent-brand-700"
          />
          Complaint alerts
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={notifyWeeklyDigest}
            onChange={(e) => setNotifyWeeklyDigest(e.target.checked)}
            className="h-4 w-4 accent-brand-700"
          />
          Weekly digest
        </label>
      </div>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save changes"}
        </Button>
        {saved ? (
          <span className="text-sm font-medium text-green-700">Saved.</span>
        ) : null}
      </div>
    </form>
  );
}

export function AdminLoyaltyForm({
  businessId,
  initial,
}: {
  businessId: string;
  initial: {
    pointsPerVisit: number;
    silverThreshold: number;
    goldThreshold: number;
    vipThreshold: number;
  };
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    pointsPerVisit: String(initial.pointsPerVisit),
    silverThreshold: String(initial.silverThreshold),
    goldThreshold: String(initial.goldThreshold),
    vipThreshold: String(initial.vipThreshold),
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const loyalty = {
      pointsPerVisit: Number(values.pointsPerVisit),
      silverThreshold: Number(values.silverThreshold),
      goldThreshold: Number(values.goldThreshold),
      vipThreshold: Number(values.vipThreshold),
    };
    if (
      !(
        loyalty.silverThreshold < loyalty.goldThreshold &&
        loyalty.goldThreshold < loyalty.vipThreshold
      )
    ) {
      setError("Thresholds must increase: Silver < Gold < VIP");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/businesses/${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loyalty }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save loyalty settings");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  const field = (key: keyof typeof values, label: string) => (
    <div>
      <Label htmlFor={`al-${key}`}>{label}</Label>
      <Input
        id={`al-${key}`}
        type="number"
        min={key === "pointsPerVisit" ? 0 : 1}
        step={1}
        required
        value={values[key]}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {field("pointsPerVisit", "Points / visit")}
        {field("silverThreshold", "Silver at")}
        {field("goldThreshold", "Gold at")}
        {field("vipThreshold", "VIP at")}
      </div>
      <p className="text-xs text-slate-400">
        Saving recalculates the tier of every customer of this business.
      </p>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save loyalty rules"}
        </Button>
        {saved ? (
          <span className="text-sm font-medium text-green-700">
            Saved — tiers recomputed.
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function SuspendBusinessButton({
  businessId,
  suspended,
}: {
  businessId: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const message = suspended
      ? "Reinstate this business? Members can log in and the public review page comes back."
      : "Suspend this business? Members can no longer log in and the public review page returns 404.";
    if (!window.confirm(message)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/businesses/${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspended: !suspended }),
      });
      if (!res.ok) {
        const data: { error?: string } = await res.json();
        setError(data.error ?? "Could not update suspension");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant={suspended ? "secondary" : "danger"}
        onClick={toggle}
        disabled={loading}
      >
        {loading ? "Working…" : suspended ? "Reinstate business" : "Suspend business"}
      </Button>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

export function DeleteBusinessButton({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [armed, setArmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/businesses/${businessId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data: { error?: string } = await res.json();
        setError(data.error ?? "Could not delete business");
        return;
      }
      router.push("/admin/businesses");
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  if (!armed) {
    return (
      <Button type="button" variant="danger" onClick={() => setArmed(true)}>
        Delete business…
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">
        This permanently deletes <strong>{businessName}</strong> with all its
        customers, visits, reviews, and member accounts. Type the business name
        to confirm:
      </p>
      <Input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={businessName}
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="danger"
          disabled={confirmText !== businessName || loading}
          onClick={onDelete}
        >
          {loading ? "Deleting…" : "Delete permanently"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setArmed(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
