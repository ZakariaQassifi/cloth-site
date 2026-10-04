-- AlterTable
ALTER TABLE "orders" ADD COLUMN "customer_postal_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_id_size_color_key" ON "product_variants"("product_id", "size", "color");

