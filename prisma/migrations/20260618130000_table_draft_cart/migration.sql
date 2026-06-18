-- Panier brouillon partagé par table (reprise serveur / sync téléphone maître)
CREATE TABLE "TableDraftCart" (
    "tableId" TEXT NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "peopleCount" INTEGER NOT NULL DEFAULT 1,
    "tableComment" TEXT,
    "guestNames" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableDraftCart_pkey" PRIMARY KEY ("tableId")
);
