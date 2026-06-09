-- CreateTable
CREATE TABLE "PrinterConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "ip" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 9100,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrinterConfig_pkey" PRIMARY KEY ("id")
);
