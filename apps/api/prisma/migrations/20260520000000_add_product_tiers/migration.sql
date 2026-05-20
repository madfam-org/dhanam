-- Preserve catalog tiers that do not have Stripe prices, such as free and
-- sales-led custom tiers. Before this table, the public catalog could only
-- reconstruct tiers from product_prices, so `prices: {}` tiers disappeared.

DO $$
DECLARE
  products_id_type TEXT;
  product_tiers_product_id_type TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO products_id_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'products'
    AND a.attname = 'id'
    AND NOT a.attisdropped;

  IF products_id_type IS NULL THEN
    RAISE EXCEPTION 'products.id must exist before creating product_tiers';
  END IF;

  IF to_regclass('public.product_tiers') IS NULL THEN
    EXECUTE format(
      'CREATE TABLE "product_tiers" (
        "id" TEXT NOT NULL,
        "product_id" %s NOT NULL,
        "tier_slug" TEXT NOT NULL,
        "dhanam_tier" "SubscriptionTier" NOT NULL,
        "display_name" TEXT,
        "description" TEXT,
        "metadata" JSONB,
        "sort_order" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "product_tiers_pkey" PRIMARY KEY ("id")
      )',
      products_id_type
    );
  ELSE
    SELECT format_type(a.atttypid, a.atttypmod)
      INTO product_tiers_product_id_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'product_tiers'
      AND a.attname = 'product_id'
      AND NOT a.attisdropped;

    IF product_tiers_product_id_type IS DISTINCT FROM products_id_type THEN
      EXECUTE format(
        'ALTER TABLE "product_tiers"
          ALTER COLUMN "product_id" TYPE %s
          USING "product_id"::%s',
        products_id_type,
        products_id_type
      );
    END IF;
  END IF;
END $$;

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
  "product_id"::TEXT || ':' || "tier_slug",
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
