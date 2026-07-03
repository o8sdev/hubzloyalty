-- Link column to auth.users (Supabase Auth). Added ahead of the destructive
-- cleanup migration so existing users can be migrated between the two.
ALTER TABLE "User" ADD COLUMN "authId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_authId_key" ON "User"("authId");
