-- CreateTable
CREATE TABLE "RestaurantSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "restaurantName" TEXT NOT NULL DEFAULT 'Asian Nour',
    "address" TEXT,
    "phone" TEXT,
    "tableCount" INTEGER NOT NULL DEFAULT 15,
    "kitchenSoundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoPrintEnabled" BOOLEAN NOT NULL DEFAULT false,
    "openingHours" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantSettings_pkey" PRIMARY KEY ("id")
);
