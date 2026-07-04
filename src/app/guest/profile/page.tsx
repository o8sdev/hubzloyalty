import { requireGuestSession } from "@/lib/session";
import { avatarTone } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { GuestLogoutButton } from "./logout-button";

export default async function GuestProfilePage() {
  const guest = await requireGuestSession();
  const initial = guest.name.charAt(0).toUpperCase() || "?";

  return (
    <div className="pt-2">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white",
            avatarTone(guest.name)
          )}
        >
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-ink">{guest.name}</p>
          <p className="truncate text-sm text-ink-faint">{guest.email}</p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-ink/15 bg-white p-3 text-sm text-ink-faint">
        Your reviews, saved places, and marketing preferences will live here
        (Phase G4).
      </div>

      <div className="mt-6">
        <GuestLogoutButton />
      </div>
    </div>
  );
}
