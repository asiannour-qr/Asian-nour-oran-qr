-- CreateTable
CREATE TABLE "TableOccupancy" (
    "tableId" TEXT NOT NULL,
    "occupiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOrderId" TEXT,

    CONSTRAINT "TableOccupancy_pkey" PRIMARY KEY ("tableId")
);
