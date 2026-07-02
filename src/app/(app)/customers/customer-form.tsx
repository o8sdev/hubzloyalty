"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  Input,
  Label,
  LinkButton,
  Textarea,
} from "@/components/ui";

export type CustomerFormInitial = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  /** YYYY-MM-DD or empty string */
  birthday: string;
  marketingConsent: boolean;
  /** comma-separated, e.g. "regular, vegan" */
  tags: string;
  notes: string;
};

/** Create (no `initial`) or edit (with `initial`) a customer. */
export function CustomerForm({ initial }: { initial?: CustomerFormInitial }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [birthday, setBirthday] = useState(initial?.birthday ?? "");
  const [marketingConsent, setMarketingConsent] = useState(
    initial?.marketingConsent ?? false
  );
  const [tags, setTags] = useState(initial?.tags ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = {
        firstName,
        lastName,
        phone,
        email,
        // "" parses to null server-side, so clearing a birthday persists.
        birthday,
        marketingConsent,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        notes,
      };
      const res = await fetch(
        initial ? `/api/customers/${initial.id}` : "/api/customers",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data: { id?: string; error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      const customerId = initial ? initial.id : data.id;
      router.push(customerId ? `/customers/${customerId}` : "/customers");
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName">First name *</Label>
              <Input
                id="firstName"
                required
                maxLength={80}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ada"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                maxLength={80}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Lovelace"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                maxLength={40}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 000 0000"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ada@example.com"
              />
            </div>
            <div>
              <Label htmlFor="birthday">Birthday</Label>
              <Input
                id="birthday"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="regular, vegan"
              />
              <p className="mt-1 text-xs text-slate-400">Comma-separated</p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-brand-700"
            />
            Customer agreed to receive marketing messages
          </label>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={4}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Allergies, preferences, anything worth remembering…"
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={loading}>
              {loading
                ? "Saving…"
                : initial
                  ? "Save changes"
                  : "Save customer"}
            </Button>
            <LinkButton
              variant="ghost"
              href={initial ? `/customers/${initial.id}` : "/customers"}
            >
              Cancel
            </LinkButton>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
