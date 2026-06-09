-- CreateTable
CREATE TABLE "AppCredential" (
    "role" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppCredential_pkey" PRIMARY KEY ("role")
);
