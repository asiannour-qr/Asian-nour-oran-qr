-- AlterTable : suppléments par ligne de commande
ALTER TABLE "OrderItem" ADD COLUMN "supplements" JSONB;

-- AlterTable : liste des suppléments client/emporter configurables par site
ALTER TABLE "RestaurantSettings" ADD COLUMN "clientSupplements" JSONB;
