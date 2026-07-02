"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardBody, CardHeader, Input, Label, PageHeader } from "@/components/ui";

export default function AdminNewBusinessPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug: slug.trim() || undefined,
          owner: { name: ownerName, email: ownerEmail, password: ownerPassword },
        }),
      });
      const data: { error?: string; businessId?: string } = await res.json();
      if (!res.ok || !data.businessId) {
        setError(data.error ?? "Could not create business");
        return;
      }
      router.push(`/admin/businesses/${data.businessId}`);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="New business"
        description="Concierge onboarding: create the tenant and its owner account in one go."
      />
      <Card className="max-w-xl">
        <CardHeader title="Business" />
        <CardBody>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Business name</Label>
              <Input
                id="name"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Blue Fern Cafe"
              />
            </div>
            <div>
              <Label htmlFor="slug">Slug (optional)</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="blue-fern-cafe (auto-generated when empty)"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
              />
              <p className="mt-1 text-xs text-slate-400">
                Public review URL: /r/&lt;slug&gt;
              </p>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-sm font-semibold text-slate-900">
                Owner account
              </p>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="owner-name">Name</Label>
                  <Input
                    id="owner-name"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="owner-email">Email</Label>
                  <Input
                    id="owner-email"
                    type="email"
                    required
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="owner-password">Temporary password</Label>
                  <Input
                    id="owner-password"
                    type="text"
                    required
                    minLength={8}
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Share it with the owner; they can change it via password reset.
                  </p>
                </div>
              </div>
            </div>

            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating…" : "Create business"}
              </Button>
              <Link
                href="/admin/businesses"
                className="text-sm text-slate-500 hover:underline"
              >
                Cancel
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
