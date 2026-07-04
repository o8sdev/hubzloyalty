import { requireGuestSession } from "@/lib/session";
import { Scanner } from "./scanner";

export default async function GuestScanPage() {
  await requireGuestSession();
  return (
    <div className="pt-2">
      <h1 className="text-2xl font-bold text-ink">Scan</h1>
      <p className="mt-0.5 text-sm text-ink-faint">
        Scan a venue&apos;s HUBz QR to check in and earn points.
      </p>
      <div className="mt-4">
        <Scanner />
      </div>
    </div>
  );
}
