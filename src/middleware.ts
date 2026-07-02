import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "lcrm_session";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token && process.env.SESSION_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET));
      return NextResponse.next();
    } catch {
      // fall through to redirect
    }
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

// Protect the owner-facing app. Public routes (/, /login, /register, /r/[slug],
// /api/public/*, /api/auth/*) are simply not matched here. API routes enforce
// auth themselves via requireApiSession().
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/customers/:path*",
    "/reviews/:path*",
    "/settings/:path*",
    "/loyalty/:path*",
    "/campaigns/:path*",
    "/analytics/:path*",
    // Platform admin. The middleware only checks for a valid JWT; the
    // platformAdmin claim itself is enforced by requirePlatformAdmin in the
    // layout and requireApiPlatformAdmin in /api/admin/* handlers.
    "/admin/:path*",
  ],
};
