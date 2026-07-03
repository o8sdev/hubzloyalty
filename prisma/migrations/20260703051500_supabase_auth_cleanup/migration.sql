-- Supabase Auth now owns credentials and reset tokens. The bcrypt hashes
-- were imported into auth.users (scripts/migrate-users-to-supabase-auth.ts)
-- before this migration drops them from the domain profile.

-- DropForeignKey
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "passwordHash";

-- DropTable
DROP TABLE "PasswordResetToken";
