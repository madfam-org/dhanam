-- Preserve catalog tiers that do not have Stripe prices, such as free and
-- sales-led custom tiers. Before this table, the public catalog could only
-- reconstruct tiers from product_prices, so `prices: {}` tiers disappeared.

CREATE TABLE IF NOT EXISTS "product_tiers" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "tier_slug" TEXT NOT NULL,
  "dhanam_tier" "SubscriptionTier" NOT NULL,
  "display_name" TEXT,
  "description" TEXT,
  "metadata" JSONB,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_tiers_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_tiers_product_id_fkey'
  ) THEN
    ALTER TABLE "product_tiers"
      ADD CONSTRAINT "product_tiers_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "product_tiers_product_id_tier_slug_key"
  ON "product_tiers"("product_id", "tier_slug");

CREATE INDEX IF NOT EXISTS "product_tiers_product_id_sort_order_idx"
  ON "product_tiers"("product_id", "sort_order");

CREATE INDEX IF NOT EXISTS "product_tiers_dhanam_tier_idx"
  ON "product_tiers"("dhanam_tier");

INSERT INTO "product_tiers" (
  "id",
  "product_id",
  "tier_slug",
  "dhanam_tier",
  "display_name",
  "description",
  "metadata",
  "sort_order",
  "updated_at"
)
SELECT DISTINCT ON ("product_id", "tier_slug")
  "product_id" || ':' || "tier_slug",
  "product_id",
  "tier_slug",
  "dhanam_tier",
  "display_name",
  "description",
  "metadata",
  0,
  COALESCE("updated_at", CURRENT_TIMESTAMP)
FROM "product_prices"
ON CONFLICT ("product_id", "tier_slug") DO NOTHING;
