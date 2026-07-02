import { NextResponse } from "next/server";

/**
 * Self-serve registration is retired: businesses are provisioned by a
 * platform admin after a demo request (/request-demo). The route stays
 * mounted so stale clients get a clear 403 instead of a 404.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Registration is invite-only. Request a demo at /request-demo and we'll set you up.",
    },
    { status: 403 }
  );
}
