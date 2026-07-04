import { GuestTabBar } from "@/components/guest-tab-bar";

// ---------------------------------------------------------------------------
// Guest (consumer) app shell — mobile-first, centred as a phone frame on wider
// screens. Scaffold only for now: the guest-session guard + auth land in the
// next slice (Phase G1). Until then these screens are placeholder previews.
// ---------------------------------------------------------------------------

export default function GuestLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto min-h-screen max-w-md border-x border-ink/10 bg-paper">
      <main className="px-4 pb-24 pt-[calc(env(safe-area-inset-top)_+_1rem)]">
        {children}
      </main>
      <GuestTabBar />
    </div>
  );
}
