// Presentation helpers for audit rows — shared by the owner Activity page,
// the admin Activity page, and the dashboard peek.

/** Emoji + short label for an action key, with a sensible fallback. */
export function actionMeta(action: string): { icon: string; label: string } {
  const map: Record<string, { icon: string; label: string }> = {
    "auth.login": { icon: "→", label: "Signed in" },
    "auth.logout": { icon: "←", label: "Signed out" },
    "checkin.confirm": { icon: "✓", label: "Check-in" },
    "gift.redeem": { icon: "🎁", label: "Gift" },
    "customer.create": { icon: "＋", label: "Guest added" },
    "customer.update": { icon: "✎", label: "Guest edited" },
    "customer.delete": { icon: "🗑", label: "Guest deleted" },
    "visit.create": { icon: "🧾", label: "Visit logged" },
    "review.update": { icon: "★", label: "Review" },
    "settings.business": { icon: "⚙", label: "Settings" },
    "settings.loyalty": { icon: "◆", label: "Loyalty" },
    "team.invite": { icon: "☺", label: "Staff invited" },
    "team.remove": { icon: "✕", label: "Staff removed" },
    "admin.business.create": { icon: "⌂", label: "Business created" },
    "admin.business.update": { icon: "⚙", label: "Business edited" },
    "admin.business.delete": { icon: "🗑", label: "Business deleted" },
  };
  return map[action] ?? { icon: "•", label: action };
}

/** Compact relative time, e.g. "just now", "5 min ago", "3h ago", "2d ago". */
export function relativeTime(date: string | Date): string {
  const t = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString();
}

/** Distinct-color chip class for a role tag. */
export function roleChip(role: string): string {
  switch (role) {
    case "PLATFORM_ADMIN":
      return "bg-brand-700 text-white";
    case "OWNER":
      return "bg-brand-50 text-brand-800 border border-brand-200";
    case "ADMIN":
      return "bg-moss/10 text-moss border border-moss/30";
    default: // STAFF
      return "bg-ink/5 text-ink-soft border border-ink/10";
  }
}
