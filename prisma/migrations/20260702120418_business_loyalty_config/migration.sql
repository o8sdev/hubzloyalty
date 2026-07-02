-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "googleReviewUrl" TEXT,
    "socialLinks" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "pointsPerVisit" INTEGER NOT NULL DEFAULT 10,
    "silverThreshold" INTEGER NOT NULL DEFAULT 5,
    "goldThreshold" INTEGER NOT NULL DEFAULT 10,
    "vipThreshold" INTEGER NOT NULL DEFAULT 20,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Business" ("address", "createdAt", "email", "googleReviewUrl", "id", "logoUrl", "name", "phone", "slug", "socialLinks", "timezone", "updatedAt", "website") SELECT "address", "createdAt", "email", "googleReviewUrl", "id", "logoUrl", "name", "phone", "slug", "socialLinks", "timezone", "updatedAt", "website" FROM "Business";
DROP TABLE "Business";
ALTER TABLE "new_Business" RENAME TO "Business";
CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
