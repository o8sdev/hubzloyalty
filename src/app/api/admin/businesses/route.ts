import { after } from "next/server";
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
import { buildClaims, supabaseAdmin } from "@/lib/supabase";
import { actorFromSession, recordAudit } from "@/lib/audit";

/** Thrown inside the provisioning transaction to surface a 400 (and roll back). */
class ProvisionError extends Error {}

/**
 * ADMIN endpoint. Invite-only onboarding: creates a business together with
 * its owner account. The server generates a one-time password for the owner
 * (mustChangePassword forces rotation at first login); the plaintext appears
 * ONLY in this response — never logged, never stored.
 *
 * Identity is created in Supabase Auth first; if the domain transaction
 * fails, the auth user is deleted again (compensation) so no orphan
 * credentials remain.
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

    // 1. Identity first.
    const { data: created, error: authError } =
      await supabaseAdmin().auth.admin.createUser({
        email: owner.email,
        password: oneTimePassword,
        email_confirm: true,
        user_metadata: { name: owner.name },
      });
    if (authError || !created.user) {
      if (authError?.code === "email_exists") {
        return badRequest("A user with this email already exists");
      }
      console.error("auth user create failed", authError);
      return serverError("Could not create owner account");
    }
    const authId = created.user.id;

    // 2. Domain rows; compensate the auth user on any failure.
    let business;
    try {
      business = await db.$transaction(async (tx) => {
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

        const createdBusiness = await tx.business.create({
          data: {
            name,
            slug,
            users: {
              create: {
                name: owner.name,
                email: owner.email,
                authId,
                role: "OWNER",
                mustChangePassword: true,
              },
            },
          },
          include: { users: { select: { id: true } } },
        });

        if (demoRequestId) {
          await tx.demoRequest.update({
            where: { id: demoRequestId },
            data: { status: "CONVERTED", convertedBusinessId: createdBusiness.id },
          });
        }

        return createdBusiness;
      });
    } catch (txErr) {
      await supabaseAdmin()
        .auth.admin.deleteUser(authId)
        .catch((e) => console.error("auth compensation delete failed", e));
      if (txErr instanceof ProvisionError) return badRequest(txErr.message);
      throw txErr;
    }

    // 3. Mirror authorization claims onto the auth user.
    const ownerProfile = business.users[0];
    const { error: claimsError } =
      await supabaseAdmin().auth.admin.updateUserById(authId, {
        app_metadata: buildClaims({
          id: ownerProfile.id,
          businessId: business.id,
          role: "OWNER",
          isPlatformAdmin: false,
          mustChangePassword: true,
        }),
      });
    if (claimsError) {
      console.error("owner claim sync failed", claimsError);
    }

    after(() =>
      recordAudit({
        businessId: business.id,
        actor: actorFromSession(auth.session),
        action: "admin.business.create",
        summary: `Created business ${name} with owner ${owner.email}`,
        targetType: "business",
        targetId: business.id,
      })
    );

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
    console.error("admin business create failed", err);
    return serverError("Could not create business");
  }
}
