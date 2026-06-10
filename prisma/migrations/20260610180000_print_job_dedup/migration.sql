-- Déduplication : lier un job à une commande + cible imprimante
ALTER TABLE "PrintJob" ADD COLUMN "orderId" TEXT;

CREATE INDEX "PrintJob_orderId_target_status_idx" ON "PrintJob"("orderId", "target", "status");
