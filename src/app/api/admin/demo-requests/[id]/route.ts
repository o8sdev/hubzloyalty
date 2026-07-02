import { db } from "@/lib/db";
import {
  badRequest,
  json,
  notFound,
  parseBody,
  requireApiPlatformAdmin,
  serverError,
} from "@/lib/http";
import { demoRequestUpdateSchema } from "@/lib/validation";

/**
 * ADMIN endpoint. Updates a demo request's status and/or adminNotes.
 * Conversion (status CONVERTED + convertedBusinessId) happens in the
 * business-create transaction, not here.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiPlatformAdmin();
  if (auth.error) return auth.error;
  const { id } = await params;

  const parsed = await parseBody(req, demoRequestUpdateSchema);
  if (parsed.error) return parsed.error;
  const { status, adminNotes } = parsed.data;

  try {
    const existing = await db.demoRequest.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) return notFound("Demo request not found");
    // CONVERTED is terminal: allowing a transition out would re-arm the lead
    // for a second conversion and orphan the first business link.
    if (status !== undefined && existing.status === "CONVERTED") {
      return badRequest(
        "Request already converted — status is managed by the business-create flow"
      );
    }

    const updated = await db.demoRequest.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(adminNotes !== undefined ? { adminNotes } : {}),
      },
    });

    return json(updated);
  } catch (err) {
    console.error("admin demo-request update failed", err);
    return serverError("Could not update demo request");
  }
}
