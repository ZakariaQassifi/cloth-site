-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "last_login_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "customer_city" TEXT NOT NULL,
    "customer_address" TEXT NOT NULL,
    "customer_postal_code" TEXT,
    "customer_notes" TEXT,
    "subtotal_price" REAL NOT NULL,
    "shipping_price" REAL NOT NULL DEFAULT 0,
    "total_price" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payment_method" TEXT NOT NULL DEFAULT 'CASH_ON_DELIVERY',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_orders" ("created_at", "customer_address", "customer_city", "customer_email", "customer_name", "customer_notes", "customer_phone", "customer_postal_code", "id", "payment_method", "shipping_price", "status", "subtotal_price", "total_price", "updated_at", "user_id") SELECT "created_at", "customer_address", "customer_city", "customer_email", "customer_name", "customer_notes", "customer_phone", "customer_postal_code", "id", "payment_method", "shipping_price", "status", "subtotal_price", "total_price", "updated_at", "user_id" FROM "orders";
DROP TABLE "orders";
ALTER TABLE "new_orders" RENAME TO "orders";
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");
CREATE INDEX "orders_customer_email_idx" ON "orders"("customer_email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");
