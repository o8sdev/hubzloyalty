// One-time migration: create a Supabase Auth identity for every existing
// User row, PRESERVING passwords (GoTrue imports bcrypt hashes verbatim via
// password_hash). Idempotent: rows that already have authId are skipped, and
// an existing auth user with the same email is linked instead of recreated.
//
// Run BEFORE the cleanup migration that drops User.passwordHash:
//   npx tsx scripts/migrate-users-to-supabase-auth.ts

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
}
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Row = {
  id: string;
  authId: string | null;
  email: string;
  name: string;
  passwordHash: string;
  role: string;
  isPlatformAdmin: boolean;
  mustChangePassword: boolean;
  businessId: string | null;
};

async function findAuthUserByEmail(email: string): Promise<string | null> {
  // Tiny user base — paging through is fine.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw error;
    const hit = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (hit) return hit.id;
    if (data.users.length < 100) break;
  }
  return null;
}

async function main() {
  // Raw SQL: passwordHash still exists in the DB, and authId may not be in
  // the generated client yet — don't depend on either being typed.
  const users = await prisma.$queryRaw<Row[]>`
    SELECT id, "authId", email, name, "passwordHash", role,
           "isPlatformAdmin", "mustChangePassword", "businessId"
    FROM "User"`;

  console.log(`Found ${users.length} user(s).`);

  for (const user of users) {
    if (user.authId) {
      console.log(`= ${user.email} already linked (${user.authId})`);
      continue;
    }

    const appMetadata = {
      profileId: user.id,
      businessId: user.businessId ?? "",
      role: user.role,
      platformAdmin: user.isPlatformAdmin,
      mustChangePassword: user.mustChangePassword,
    };

    let authId: string | null = null;
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password_hash: user.passwordHash,
      email_confirm: true,
      user_metadata: { name: user.name },
      app_metadata: appMetadata,
    });

    if (error) {
      if (error.code === "email_exists") {
        authId = await findAuthUserByEmail(user.email);
        if (!authId) throw new Error(`email_exists but not found: ${user.email}`);
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          authId,
          { app_metadata: appMetadata, user_metadata: { name: user.name } }
        );
        if (updateError) throw updateError;
        console.log(`~ ${user.email} linked to existing auth user ${authId}`);
      } else {
        throw new Error(`createUser failed for ${user.email}: ${error.message}`);
      }
    } else {
      authId = data.user!.id;
      console.log(`+ ${user.email} -> auth user ${authId} (password preserved)`);
    }

    await prisma.$executeRaw`UPDATE "User" SET "authId" = ${authId} WHERE id = ${user.id}`;
  }

  const unlinked = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*)::bigint AS count FROM "User" WHERE "authId" IS NULL`;
  console.log(`Done. Unlinked users remaining: ${unlinked[0].count}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("Migration failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
