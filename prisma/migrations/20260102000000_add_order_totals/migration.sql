-- Persist the subtotal / shipping breakdown so the admin order views can show
-- the full money breakdown instead of a single total.

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "subtotal_price" REAL NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "shipping_price" REAL NOT NULL DEFAULT 0;

-- Backfill existing orders: subtotal is the sum of their line totals and
-- shipping is whatever the stored total did not already account for.
UPDATE "orders"
SET "subtotal_price" = COALESCE((
      SELECT SUM("order_items"."total_price")
      FROM "order_items"
      WHERE "order_items"."order_id" = "orders"."id"
    ), 0);

UPDATE "orders"
SET "shipping_price" = MAX("total_price" - "subtotal_price", 0);