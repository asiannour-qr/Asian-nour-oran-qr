-- PrintJob : cible imprimante (cuisine ou caisse)
ALTER TABLE "PrintJob" ADD COLUMN "target" TEXT NOT NULL DEFAULT 'kitchen';

-- Migrer l'ancienne config unique vers l'imprimante cuisine
UPDATE "PrintJob" SET "target" = 'kitchen' WHERE "target" IS NULL OR "target" = '';
UPDATE "PrinterConfig" SET "id" = 'kitchen' WHERE "id" = 'default';
