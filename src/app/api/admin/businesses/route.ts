import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  badRequest,
  json,
  parseBody,
  requireApiPlatformAdmin,
  serverError,
} from "@/lib/http";
import { adminBusinessCreateSchema, slugify } from "@/lib/validation";
import { generateOneTimePassword } from "@/lib/onetime";

/** Thrown inside the provisioning transaction to surface a 400 (and roll back). */
class ProvisionError extends Error {}

/**
 * ADMIN endpoint. Invite-only onboarding: creates a business together with
 * its owner account. The server generates a one-time password for the owner
 * (mustChangePassword forces rotation at first login); the plaintext appears
 * ONLY in this response — never logged, never stored.
 *
 * When demoRequestId is provided, the demo request is marked CONVERTED in
 * the same transaction.
 */
export async function POST(req: Request) {
  const auth = await requireApiPlatformAdmin();
  if (auth.error) return auth.error;

  const parsed = await parseBody(req, adminBusinessCreateSchema);
  if (parsed.error) return parsed.error;
  const { name, slug: requestedSlug, owner, demoRequestId } = parsed.data;

  try {
    const existingUser = await db.user.findUnique({
      where: { email: owner.email },
    });
    if (existingUser) {
      return badRequest("A user with this email already exists");
    }

    const slug = requestedSlug ?? slugify(name);
    const existingSlug = await db.business.findUnique({ where: { slug } });
    if (existingSlug) {
      return badRequest(`The slug "${slug}" is already taken`);
    }

    const oneTimePassword = generateOneTimePassword();
    const passwordHash = await bcrypt.hash(oneTimePassword, 10);

    const business = await db.$transaction(async (tx) => {
      if (demoRequestId) {
        const request = await tx.demoRequest.findUnique({
          where: { id: demoRequestId },
        });
        if (!request) throw new ProvisionError("Demo request not found");
        // Positive guard: only workable leads convert. The UI hides the
        // button for terminal statuses, but another admin may have
        // dismissed/converted the lead since this page was opened.
        if (request.status !== "NEW" && request.status !== "CONTACTED") {
          throw new ProvisionError(
            request.status === "CONVERTED"
              ? "Already converted"
              : "This demo request was dismissed — set it back to contacted before converting"
          );
        }
      }

      const created = await tx.business.create({
        data: {
          name,
          slug,
          users: {
            create: {
              name: owner.name,
              email: owner.email,
              passwordHash,
              role: "OWNER",
              mustChangePassword: true,
            },
          },
        },
      });

      if (demoRequestId) {
        await tx.demoRequest.update({
          where: { id: demoRequestId },
          data: { status: "CONVERTED", convertedBusinessId: created.id },
        });
      }

      return created;
    });

    return json(
      {
        ok: true,
        businessId: business.id,
        slug: business.slug,
        ownerEmail: owner.email,
        oneTimePassword,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof ProvisionError) return badRequest(err.message);
    console.error("admin business create failed", err);
    return serverError("Could not create business");
  }
}
