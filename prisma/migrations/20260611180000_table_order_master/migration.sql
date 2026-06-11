-- CreateTable
CREATE TABLE "TableOrderMaster" (
    "tableId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableOrderMaster_pkey" PRIMARY KEY ("tableId")
);
