-- Reconcile production drift discovered by ecosystem health audit:
-- - product catalog tables existed without their Prisma enum types
-- - users table was missing KYC convenience columns used by Prisma includes

DO $$
BEGIN
  CREATE TYPE "ProductCategory" AS ENUM (
    'compliance',
    'finance',
    'legal',
    'infrastructure',
    'intelligence',
    'fabrication',
    'crm',
    'platform'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "BillingInterval" AS ENUM ('monthly', 'yearly');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PriceStatus" AS ENUM ('active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "kyc_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "kyc_verified_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "products" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" "ProductCategory" NOT NULL DEFAULT 'platform',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "icon_url" TEXT,
  "website_url" TEXT,
  "stripe_product_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "product_prices" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "tier_slug" TEXT NOT NULL,
  "dhanam_tier" "SubscriptionTier" NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "interval" "BillingInterval" NOT NULL DEFAULT 'monthly',
  "amount_cents" INTEGER NOT NULL,
  "status" "PriceStatus" NOT NULL DEFAULT 'active',
  "stripe_price_id" TEXT,
  "display_name" TEXT,
  "description" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "product_features" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "tier_slug" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_features_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "product_credit_costs" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "credits" INTEGER NOT NULL,
  "label" TEXT,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_credit_costs_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'category'
      AND udt_name <> 'ProductCategory'
  ) THEN
    ALTER TABLE "products" ALTER COLUMN "category" DROP DEFAULT;
    ALTER TABLE "products"
      ALTER COLUMN "category" TYPE "ProductCategory"
      USING COALESCE(NULLIF("category"::TEXT, ''), 'platform')::"ProductCategory";
  END IF;
END $$;

ALTER TABLE "products" ALTER COLUMN "category" SET DEFAULT 'platform';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_prices'
      AND column_name = 'dhanam_tier'
      AND udt_name <> 'SubscriptionTier'
  ) THEN
    ALTER TABLE "product_prices"
      ALTER COLUMN "dhanam_tier" TYPE "SubscriptionTier"
      USING "dhanam_tier"::TEXT::"SubscriptionTier";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_prices'
      AND column_name = 'interval'
      AND udt_name <> 'BillingInterval'
  ) THEN
    ALTER TABLE "product_prices" ALTER COLUMN "interval" DROP DEFAULT;
    ALTER TABLE "product_prices"
      ALTER COLUMN "interval" TYPE "BillingInterval"
      USING COALESCE(NULLIF("interval"::TEXT, ''), 'monthly')::"BillingInterval";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_prices'
      AND column_name = 'status'
      AND udt_name <> 'PriceStatus'
  ) THEN
    ALTER TABLE "product_prices" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "product_prices"
      ALTER COLUMN "status" TYPE "PriceStatus"
      USING COALESCE(NULLIF("status"::TEXT, ''), 'active')::"PriceStatus";
  END IF;
END $$;

ALTER TABLE "product_prices" ALTER COLUMN "interval" SET DEFAULT 'monthly';
ALTER TABLE "product_prices" ALTER COLUMN "status" SET DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_slug_key') THEN
    ALTER TABLE "products" ADD CONSTRAINT "products_slug_key" UNIQUE ("slug");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_stripe_product_id_key') THEN
    ALTER TABLE "products" ADD CONSTRAINT "products_stripe_product_id_key" UNIQUE ("stripe_product_id");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_prices_product_id_tier_slug_currency_interval_key'
  ) THEN
    ALTER TABLE "product_prices"
      ADD CONSTRAINT "product_prices_product_id_tier_slug_currency_interval_key"
      UNIQUE ("product_id", "tier_slug", "currency", "interval");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_prices_stripe_price_id_key') THEN
    ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_stripe_price_id_key" UNIQUE ("stripe_price_id");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_features_product_id_tier_slug_feature_key'
  ) THEN
    ALTER TABLE "product_features"
      ADD CONSTRAINT "product_features_product_id_tier_slug_feature_key"
      UNIQUE ("product_id", "tier_slug", "feature");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_credit_costs_product_id_operation_key'
  ) THEN
    ALTER TABLE "product_credit_costs"
      ADD CONSTRAINT "product_credit_costs_product_id_operation_key"
      UNIQUE ("product_id", "operation");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_prices_product_id_fkey') THEN
    ALTER TABLE "product_prices"
      ADD CONSTRAINT "product_prices_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_features_product_id_fkey') THEN
    ALTER TABLE "product_features"
      ADD CONSTRAINT "product_features_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_credit_costs_product_id_fkey') THEN
    ALTER TABLE "product_credit_costs"
      ADD CONSTRAINT "product_credit_costs_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "products_active_sort_order_idx" ON "products"("active", "sort_order");
CREATE INDEX IF NOT EXISTS "product_prices_product_id_status_idx" ON "product_prices"("product_id", "status");
CREATE INDEX IF NOT EXISTS "product_prices_dhanam_tier_idx" ON "product_prices"("dhanam_tier");
CREATE INDEX IF NOT EXISTS "product_features_product_id_tier_slug_idx" ON "product_features"("product_id", "tier_slug");
CREATE INDEX IF NOT EXISTS "product_credit_costs_product_id_idx" ON "product_credit_costs"("product_id");
