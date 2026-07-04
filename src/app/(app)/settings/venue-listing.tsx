"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { BUSINESS_CATEGORIES } from "@/lib/validation";
import { cn } from "@/lib/utils";

// Owner control for the guest-app venue listing: opt-in, text profile, and
// photos (main / logo / capped gallery) uploaded via /api/business/media.

type Photo = { id: string; url: string };
const GALLERY_CAP = 8;

function SingleImage({
  label,
  hint,
  url,
  busy,
  onPick,
  onRemove,
  aspect,
}: {
  label: string;
  hint: string;
  url: string | null;
  busy: boolean;
  onPick: (f: File) => void;
  onRemove: () => void;
  aspect: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-ink">
        {label} <span className="text-xs font-normal text-ink-faint">· {hint}</span>
      </p>
      <div className={cn("relative overflow-hidden rounded-xl border border-ink/15 bg-paper", aspect)}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-ink-faint">
            No image
          </div>
        )}
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/40 text-xs text-white">
            Uploading…
          </div>
        ) : null}
      </div>
      <div className="mt-1.5 flex gap-2">
        <input
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-paper disabled:opacity-50"
        >
          {url ? "Replace" : "Upload"}
        </button>
        {url ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function VenueListing({
  initial,
}: {
  initial: {
    listed: boolean;
    category: string;
    description: string;
    city: string;
    coverImageUrl: string | null;
    logoUrl: string | null;
    photos: Photo[];
  };
}) {
  const router = useRouter();
  const [listed, setListed] = useState(initial.listed);
  const [category, setCategory] = useState(initial.category);
  const [description, setDescription] = useState(initial.description);
  const [city, setCity] = useState(initial.city);
  const [cover, setCover] = useState(initial.coverImageUrl);
  const [logo, setLogo] = useState(initial.logoUrl);
  const [photos, setPhotos] = useState<Photo[]>(initial.photos);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const addRef = useRef<HTMLInputElement>(null);

  async function saveFields(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listed, category, description, city }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save the listing");
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

  async function upload(kind: "cover" | "logo" | "gallery", file: File) {
    setBusy(kind === "gallery" ? "gallery:add" : kind);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("kind", kind);
      const res = await fetch("/api/business/media", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      if (kind === "cover") setCover(data.url);
      else if (kind === "logo") setLogo(data.url);
      else setPhotos((p) => [...p, data.photo]);
      router.refresh();
    } catch {
      setError("Upload failed — please try again");
    } finally {
      setBusy(null);
    }
  }

  async function removeMedia(kind: "cover" | "logo" | "gallery", photoId?: string) {
    setBusy(kind === "gallery" ? `del:${photoId}` : kind);
    setError(null);
    try {
      const res = await fetch("/api/business/media", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, photoId }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Could not remove");
        return;
      }
      if (kind === "cover") setCover(null);
      else if (kind === "logo") setLogo(null);
      else setPhotos((p) => p.filter((x) => x.id !== photoId));
      router.refresh();
    } catch {
      setError("Could not remove — please try again");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <form onSubmit={saveFields} className="space-y-4">
        <label className="flex items-start gap-3 rounded-xl border border-ink/10 bg-paper p-3">
          <input
            type="checkbox"
            checked={listed}
            onChange={(e) => setListed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-ink"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">
              List in Discover
            </span>
            <span className="block text-xs text-ink-faint">
              Show this venue to guests in the app directory.
            </span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="vl-cat">Category</Label>
            <Select
              id="vl-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Choose…</option>
              {BUSINESS_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="vl-city">City</Label>
            <Input
              id="vl-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Baku"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="vl-desc">Description</Label>
          <Textarea
            id="vl-desc"
            rows={3}
            maxLength={600}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What makes your place special…"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save listing"}
          </Button>
          {saved ? <span className="text-sm font-medium text-moss">Saved.</span> : null}
        </div>
      </form>

      <hr className="border-ink/10" />

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SingleImage
            label="Main photo"
            hint="wide cover"
            url={cover}
            busy={busy === "cover"}
            onPick={(f) => upload("cover", f)}
            onRemove={() => removeMedia("cover")}
            aspect="aspect-[16/9]"
          />
          <SingleImage
            label="Logo"
            hint="square"
            url={logo}
            busy={busy === "logo"}
            onPick={(f) => upload("logo", f)}
            onRemove={() => removeMedia("logo")}
            aspect="aspect-[16/9]"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-ink">
              Gallery{" "}
              <span className="font-normal text-ink-faint">
                ({photos.length}/{GALLERY_CAP})
              </span>
            </p>
            {photos.length < GALLERY_CAP ? (
              <>
                <input
                  ref={addRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload("gallery", f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => addRef.current?.click()}
                  disabled={busy === "gallery:add"}
                  className="rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper disabled:opacity-50"
                >
                  {busy === "gallery:add" ? "Uploading…" : "+ Add photo"}
                </button>
              </>
            ) : null}
          </div>
          {photos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink/15 bg-paper p-4 text-center text-xs text-ink-faint">
              No gallery photos yet.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className="relative aspect-square overflow-hidden rounded-lg border border-ink/10"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeMedia("gallery", p.id)}
                    disabled={busy === `del:${p.id}`}
                    aria-label="Remove photo"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-xs text-white hover:bg-ink disabled:opacity-50"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
