import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase";

/**
 * Landing point for Supabase Auth email links (password recovery, invites,
 * email changes). Exchanges the token_hash for a session (sets cookies),
 * then forwards to the in-app destination.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/reset-password";

  // Same-origin paths only — never redirect off-site.
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
      ? next
      : "/reset-password";

  if (tokenHash && type) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, req.url));
    }
  }

  return NextResponse.redirect(
    new URL("/forgot-password?error=expired", req.url)
  );
}
