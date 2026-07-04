import { NextResponse } from "next/server";
import type { ZodType, ZodTypeDef } from "zod";
import { getSession, type Session } from "@/lib/session";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message = "Something went wrong") {
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Parse + validate a JSON request body.
 * Returns { data } on success or { error: Response } to return directly.
 */
export async function parseBody<T>(
  req: Request,
  // Input type is decoupled from output so schemas with transforms
  // (e.g. "" -> null) are accepted.
  schema: ZodType<T, ZodTypeDef, unknown>
): Promise<{ data: T; error?: undefined } | { data?: undefined; error: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { error: badRequest("Invalid JSON body") };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      error: badRequest("Validation failed", result.error.flatten().fieldErrors),
    };
  }
  return { data: result.data };
}

/**
 * For API route handlers: returns the session or a 401 response.
 * Usage:
 *   const auth = await requireApiSession();
 *   if (auth.error) return auth.error;
 *   const { businessId } = auth.session;
 */
export async function requireApiSession(): Promise<
  { session: Session; error?: undefined } | { session?: undefined; error: NextResponse }
> {
  const session = await getSession();
  if (!session?.businessId) return { error: unauthorized() };
  return { session };
}

/** For /api/guest/* handlers: requires a guest (consumer) session. */
export async function requireApiGuestSession(): Promise<
  | { guest: { guestId: string; email: string; name: string }; error?: undefined }
  | { guest?: undefined; error: NextResponse }
> {
  const session = await getSession();
  if (!session || session.role !== "GUEST") return { error: unauthorized() };
  return {
    guest: { guestId: session.userId, email: session.email, name: session.name },
  };
}

/** For /api/admin/* handlers: requires a platform-admin session. */
export async function requireApiPlatformAdmin(): Promise<
  { session: Session; error?: undefined } | { session?: undefined; error: NextResponse }
> {
  const session = await getSession();
  if (!session) return { error: unauthorized() };
  if (!session.platformAdmin) return { error: forbidden() };
  return { session };
}
