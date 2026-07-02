import { NextResponse } from "next/server";
import type { ZodType } from "zod";
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
  schema: ZodType<T>
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
