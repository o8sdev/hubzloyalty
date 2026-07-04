-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "category" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "coverImageUrl" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "listed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "guestId" TEXT;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'FUNNEL',
ADD COLUMN     "guestId" TEXT;

-- CreateTable
CREATE TABLE "BusinessPhoto" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "authId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessPhoto_businessId_position_idx" ON "BusinessPhoto"("businessId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_authId_key" ON "Guest"("authId");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_email_key" ON "Guest"("email");

-- CreateIndex
CREATE INDEX "Guest_email_idx" ON "Guest"("email");

-- CreateIndex
CREATE INDEX "Customer_guestId_idx" ON "Customer"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_businessId_guestId_key" ON "Customer"("businessId", "guestId");

-- CreateIndex
CREATE INDEX "Review_businessId_channel_createdAt_idx" ON "Review"("businessId", "channel", "createdAt");

-- AddForeignKey
ALTER TABLE "BusinessPhoto" ADD CONSTRAINT "BusinessPhoto_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security on new tables: blocks Supabase PostgREST (anon/service
-- REST); Prisma connects as the table owner and is unaffected. No policies =
-- deny-all over the REST API.
ALTER TABLE "Guest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BusinessPhoto" ENABLE ROW LEVEL SECURITY;
