// ---------------------------------------------------------------------------
// Deterministic monochrome avatar tones for guests. Same name → same shade on
// every render (server + client). Flat near-black/grey solids keep the guest
// book modern and let the red UI accents stay the focal point. Full class
// strings are kept literal so Tailwind's content scanner emits them.
// ---------------------------------------------------------------------------

const AVATAR_TONES = [
  "bg-zinc-900",
  "bg-zinc-700",
  "bg-neutral-800",
  "bg-stone-700",
  "bg-zinc-800",
  "bg-neutral-900",
  "bg-zinc-600",
  "bg-stone-800",
] as const;

/** Pick a stable warm gradient for a guest from their name. */
export function avatarTone(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

/** One- or two-letter initials from a guest's name parts. */
export function initials(firstName: string, lastName?: string | null): string {
  const first = firstName.trim().charAt(0);
  const last = lastName?.trim().charAt(0) ?? "";
  return (first + last).toUpperCase() || "?";
}
