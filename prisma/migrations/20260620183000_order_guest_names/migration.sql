-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "guestNames" JSONB;
