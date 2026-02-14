-- First, remove duplicate rows keeping only the earliest entry per (shop, orderId, type)
DELETE FROM "LoyaltyLog"
WHERE id NOT IN (
  SELECT MIN(id) FROM "LoyaltyLog"
  WHERE "orderId" IS NOT NULL
  GROUP BY shop, "orderId", type
)
AND "orderId" IS NOT NULL
AND type = 'purchase_credit';

-- CreateIndex (unique constraint to prevent duplicate order credits)
CREATE UNIQUE INDEX "unique_order_credit" ON "LoyaltyLog"("shop", "orderId", "type");
