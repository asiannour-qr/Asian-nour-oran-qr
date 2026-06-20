-- AlterTable
ALTER TABLE "RestaurantSettings" ALTER COLUMN "tableCount" SET DEFAULT 20;
UPDATE "RestaurantSettings" SET "tableCount" = 20 WHERE "tableCount" = 15;
