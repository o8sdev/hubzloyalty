"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Label,
  LinkButton,
} from "@/components/ui";

type Prefill = {
  demoRequestId: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
};

type Created = {
  businessId: string;
  slug: string;
  ownerEmail: string;
  oneTimePassword: string;
};

/**
 * Create form for concierge onboarding. The server generates the owner's
 * one-time password; on success the form is replaced by a panel showing it —
 * the only place the plaintext ever appears.
 */
export function NewBusinessForm({ prefill }: { prefill?: Prefill }) {
  const router = useRouter();
  const [name, setName] = useState(prefill?.name ?? "");
  const [slug, setSlug] = useState("");
  const [ownerName, setOwnerName] = useState(prefill?.ownerName ?? "");
  const [ownerEmail, setOwnerEmail] = useState(prefill?.ownerEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

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
          owner: { name: ownerName, email: ownerEmail },
          // Hidden pass-through: set when converting a demo request.
          demoRequestId: prefill?.demoRequestId,
        }),
      });
      const data: Partial<Created> & { error?: string } = await res.json();
      if (!res.ok || !data.businessId || !data.oneTimePassword) {
        setError(data.error ?? "Could not create business");
        return;
      }
      setCreated({
        businessId: data.businessId,
        slug: data.slug ?? "",
        ownerEmail: data.ownerEmail ?? ownerEmail,
        oneTimePassword: data.oneTimePassword,
      });
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  async function onCopy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.oneTimePassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — select the password and copy it manually");
    }
  }

  if (created) {
    return (
      <Card className="max-w-xl">
        <CardHeader
          title="Business created"
          description={`/r/${created.slug} is live. Owner account: ${created.ownerEmail}`}
        />
        <CardBody className="space-y-4">
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">
              One-time password
            </p>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 select-all rounded-lg bg-slate-900 px-4 py-3 text-center font-mono text-xl font-semibold tracking-widest text-amber-400">
                {created.oneTimePassword}
              </code>
              <Button type="button" variant="secondary" onClick={onCopy}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Shown only once. Share it with the owner over a trusted channel —
            they&apos;ll be asked to set their own password at first login.
          </p>
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
            <LinkButton href={`/admin/businesses/${created.businessId}`}>
              View business
            </LinkButton>
            <Link
              href="/admin/demo-requests"
              className="text-sm text-slate-500 hover:underline"
            >
              Back to demo requests
            </Link>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
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
              <p className="text-xs text-slate-400">
                A one-time password is generated automatically and shown once
                after creation; the owner sets their own at first login.
              </p>
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
  );
}
