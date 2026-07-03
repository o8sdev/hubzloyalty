import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase session cookie when needed and gates the app shells
 * on having one. This is a cheap presence/refresh check — authenticity and
 * the platformAdmin claim are enforced server-side by requireSession /
 * requirePlatformAdmin (src/lib/session.ts), which verify the token.
 */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            req.cookies.set(name, value);
          }
          res = NextResponse.next({ request: req });
          for (const { name, value, options } of cookiesToSet) {
            res.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Reads the cookie and refreshes the token if expired (network only then).
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) return res;

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

// Protect the owner-facing app. Public routes (/, /login, /request-demo,
// /r/[slug], /api/public/*, /api/auth/*, /auth/*) are simply not matched
// here. API routes enforce auth themselves via requireApiSession().
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/customers/:path*",
    "/reviews/:path*",
    "/settings/:path*",
    "/loyalty/:path*",
    "/campaigns/:path*",
    "/analytics/:path*",
    "/change-password",
    // Platform admin. The middleware only checks for a session; the
    // platformAdmin claim itself is enforced by requirePlatformAdmin in the
    // layout and requireApiPlatformAdmin in /api/admin/* handlers.
    "/admin/:path*",
  ],
};
