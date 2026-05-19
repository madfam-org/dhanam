-- Reconcile schema drift left after earlier partial production migrations.
-- This migration is intentionally idempotent because production may already
-- contain some of these objects from manual/bootstrap operations.

DO $$
BEGIN
  CREATE TYPE "CancellationReason" AS ENUM (
    'too_expensive',
    'missing_features',
    'switched_service',
    'unused',
    'technical_issues',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CancellationIntentOutcome" AS ENUM (
    'retained_discount',
    'retained_pause',
    'retained_support',
    'cancelled',
    'abandoned'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ReportFormat" AS ENUM ('pdf', 'csv', 'excel', 'json');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ReportShareStatus" AS ENUM ('pending', 'accepted', 'declined', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DocumentCategory" AS ENUM (
    'bank_statement',
    'tax_document',
    'csv_import',
    'receipt',
    'invoice',
    'contract',
    'insurance',
    'appraisal',
    'deed',
    'title',
    'certificate',
    'statement',
    'photo',
    'general'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DocumentStatus" AS ENUM (
    'pending_upload',
    'uploaded',
    'processing',
    'ready',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "RewardType" AS ENUM (
    'subscription_extension',
    'credit_grant',
    'tier_discount'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AmbassadorTier" AS ENUM ('none', 'bronze', 'silver', 'gold', 'platinum');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "BillingEventType" ADD VALUE IF NOT EXISTS 'subscription_paused';
ALTER TYPE "BillingEventType" ADD VALUE IF NOT EXISTS 'cancel_intent_created';
ALTER TYPE "BillingEventType" ADD VALUE IF NOT EXISTS 'save_offer_accepted';
ALTER TYPE "BillingStatus" ADD VALUE IF NOT EXISTS 'paused';
ALTER TYPE "BudgetPeriod" ADD VALUE IF NOT EXISTS 'weekly';
ALTER TYPE "BudgetPeriod" ADD VALUE IF NOT EXISTS 'biweekly';
ALTER TYPE "Currency" ADD VALUE IF NOT EXISTS 'CAD';
ALTER TYPE "SubscriptionTier" ADD VALUE IF NOT EXISTS 'premium';

DROP INDEX IF EXISTS "idx_txn_description_trgm";
DROP INDEX IF EXISTS "idx_txn_merchant_trgm";

ALTER TABLE "budgets"
  ADD COLUMN IF NOT EXISTS "custom_end_day" INTEGER,
  ADD COLUMN IF NOT EXISTS "custom_start_day" INTEGER,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "exclude_from_budget" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "exclude_from_totals" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "group_name" TEXT,
  ADD COLUMN IF NOT EXISTS "is_income" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'category'
      AND udt_name <> 'DocumentCategory'
  ) THEN
    ALTER TABLE "documents" ALTER COLUMN "category" DROP DEFAULT;
    ALTER TABLE "documents"
      ALTER COLUMN "category" TYPE "DocumentCategory"
      USING (
        CASE
          WHEN "category"::TEXT IN (
            'bank_statement',
            'tax_document',
            'csv_import',
            'receipt',
            'invoice',
            'contract',
            'insurance',
            'appraisal',
            'deed',
            'title',
            'certificate',
            'statement',
            'photo',
            'general'
          )
          THEN "category"::TEXT
          ELSE 'general'
        END
      )::"DocumentCategory";
  END IF;
END $$;

ALTER TABLE "documents" ALTER COLUMN "category" SET DEFAULT 'general';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'status'
      AND udt_name <> 'DocumentStatus'
  ) THEN
    ALTER TABLE "documents" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "documents"
      ALTER COLUMN "status" TYPE "DocumentStatus"
      USING (
        CASE
          WHEN "status"::TEXT IN ('pending_upload', 'uploaded', 'processing', 'ready', 'failed')
          THEN "status"::TEXT
          ELSE 'pending_upload'
        END
      )::"DocumentStatus";
  END IF;
END $$;

ALTER TABLE "documents" ALTER COLUMN "status" SET DEFAULT 'pending_upload';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'generated_reports'
      AND column_name = 'format'
      AND udt_name <> 'ReportFormat'
  ) THEN
    ALTER TABLE "generated_reports"
      ALTER COLUMN "format" TYPE "ReportFormat"
      USING (
        CASE
          WHEN "format"::TEXT IN ('pdf', 'csv', 'excel', 'json') THEN "format"::TEXT
          ELSE 'pdf'
        END
      )::"ReportFormat";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'report_shares'
      AND column_name = 'status'
      AND udt_name <> 'ReportShareStatus'
  ) THEN
    ALTER TABLE "report_shares" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "report_shares"
      ALTER COLUMN "status" TYPE "ReportShareStatus"
      USING (
        CASE
          WHEN "status"::TEXT IN ('pending', 'accepted', 'declined', 'revoked')
          THEN "status"::TEXT
          ELSE 'pending'
        END
      )::"ReportShareStatus";
  END IF;
END $$;

ALTER TABLE "report_shares" ALTER COLUMN "status" SET DEFAULT 'pending';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saved_reports'
      AND column_name = 'format'
      AND udt_name <> 'ReportFormat'
  ) THEN
    ALTER TABLE "saved_reports" ALTER COLUMN "format" DROP DEFAULT;
    ALTER TABLE "saved_reports"
      ALTER COLUMN "format" TYPE "ReportFormat"
      USING (
        CASE
          WHEN "format"::TEXT IN ('pdf', 'csv', 'excel', 'json') THEN "format"::TEXT
          ELSE 'pdf'
        END
      )::"ReportFormat";
  END IF;
END $$;

ALTER TABLE "saved_reports" ALTER COLUMN "format" SET DEFAULT 'pdf';

ALTER TABLE "product_credit_costs" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "product_prices" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "products" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "transaction_rules" ADD COLUMN IF NOT EXISTS "actions" JSONB;

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "exclude_from_totals" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reviewed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pricing_region" INTEGER,
  ADD COLUMN IF NOT EXISTS "promo_ends_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "promo_started_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "subscription_paused_until" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trial_has_credit_card" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "trial_tier" "SubscriptionTier";

CREATE TABLE IF NOT EXISTS "pricing_regions" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "discount" DOUBLE PRECISION NOT NULL,
  "countries" TEXT[],
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pricing_regions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tags" (
  "id" TEXT NOT NULL,
  "space_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "transaction_tags" (
  "transaction_id" TEXT NOT NULL,
  "tag_id" TEXT NOT NULL,
  CONSTRAINT "transaction_tags_pkey" PRIMARY KEY ("transaction_id", "tag_id")
);

CREATE TABLE IF NOT EXISTS "usage_events" (
  "id" TEXT NOT NULL,
  "org_id" TEXT NOT NULL,
  "service" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "credits" INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "credit_balances" (
  "id" TEXT NOT NULL,
  "org_id" TEXT NOT NULL,
  "credits_included" INTEGER NOT NULL DEFAULT 100,
  "credits_used" INTEGER NOT NULL DEFAULT 0,
  "overage_credits" INTEGER NOT NULL DEFAULT 0,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "credit_balances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cancellation_intents" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "reason" "CancellationReason" NOT NULL,
  "reason_text" TEXT,
  "outcome" "CancellationIntentOutcome" NOT NULL DEFAULT 'abandoned',
  "save_offer_type" TEXT,
  "pause_months" INTEGER,
  "discount_percent" INTEGER,
  "discount_months" INTEGER,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cancellation_intents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "referral_rewards" (
  "id" TEXT NOT NULL,
  "referral_id" TEXT NOT NULL,
  "recipient_user_id" TEXT NOT NULL,
  "reward_type" "RewardType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "applied" BOOLEAN NOT NULL DEFAULT false,
  "applied_at" TIMESTAMP(3),
  "stripe_action_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "referral_rewards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ambassador_profiles" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "tier" "AmbassadorTier" NOT NULL DEFAULT 'none',
  "total_referrals" INTEGER NOT NULL DEFAULT 0,
  "total_conversions" INTEGER NOT NULL DEFAULT 0,
  "lifetime_credits_earned" INTEGER NOT NULL DEFAULT 0,
  "lifetime_months_earned" INTEGER NOT NULL DEFAULT 0,
  "discount_percent" INTEGER NOT NULL DEFAULT 0,
  "public_profile" BOOLEAN NOT NULL DEFAULT false,
  "display_name" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ambassador_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "usage_alert_ingests" (
  "id" TEXT NOT NULL,
  "waybill_alert_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "budget_id" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "threshold_crossed" INTEGER NOT NULL,
  "actual_cents" BIGINT NOT NULL,
  "budget_cents" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "service_breakdown" JSONB,
  "notified_at" TIMESTAMP(3),
  "seen_count" INTEGER NOT NULL DEFAULT 1,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_alert_ingests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pricing_regions_name_key" ON "pricing_regions"("name");
CREATE INDEX IF NOT EXISTS "tags_space_id_sort_order_idx" ON "tags"("space_id", "sort_order");
CREATE UNIQUE INDEX IF NOT EXISTS "tags_space_id_name_key" ON "tags"("space_id", "name");
CREATE INDEX IF NOT EXISTS "transaction_tags_tag_id_idx" ON "transaction_tags"("tag_id");
CREATE UNIQUE INDEX IF NOT EXISTS "usage_events_idempotency_key_key" ON "usage_events"("idempotency_key");
CREATE INDEX IF NOT EXISTS "usage_events_org_id_created_at_idx" ON "usage_events"("org_id", "created_at");
CREATE INDEX IF NOT EXISTS "usage_events_org_id_service_idx" ON "usage_events"("org_id", "service");
CREATE UNIQUE INDEX IF NOT EXISTS "credit_balances_org_id_key" ON "credit_balances"("org_id");
CREATE INDEX IF NOT EXISTS "credit_balances_org_id_idx" ON "credit_balances"("org_id");
CREATE INDEX IF NOT EXISTS "cancellation_intents_user_id_created_at_idx" ON "cancellation_intents"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "cancellation_intents_outcome_idx" ON "cancellation_intents"("outcome");
CREATE INDEX IF NOT EXISTS "referral_rewards_recipient_user_id_idx" ON "referral_rewards"("recipient_user_id");
CREATE INDEX IF NOT EXISTS "referral_rewards_applied_idx" ON "referral_rewards"("applied");
CREATE UNIQUE INDEX IF NOT EXISTS "ambassador_profiles_user_id_key" ON "ambassador_profiles"("user_id");
CREATE INDEX IF NOT EXISTS "ambassador_profiles_tier_idx" ON "ambassador_profiles"("tier");
CREATE INDEX IF NOT EXISTS "usage_alert_ingests_project_id_created_at_idx" ON "usage_alert_ingests"("project_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "usage_alert_ingests_notified_at_idx" ON "usage_alert_ingests"("notified_at");
CREATE UNIQUE INDEX IF NOT EXISTS "usage_alert_ingests_project_id_period_start_threshold_cross_key" ON "usage_alert_ingests"("project_id", "period_start", "threshold_crossed");
CREATE INDEX IF NOT EXISTS "documents_space_id_status_idx" ON "documents"("space_id", "status");
CREATE INDEX IF NOT EXISTS "documents_space_id_category_idx" ON "documents"("space_id", "category");
CREATE INDEX IF NOT EXISTS "report_shares_shared_with_status_idx" ON "report_shares"("shared_with", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tags_space_id_fkey') THEN
    ALTER TABLE "tags"
      ADD CONSTRAINT "tags_space_id_fkey"
      FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transaction_tags_transaction_id_fkey') THEN
    ALTER TABLE "transaction_tags"
      ADD CONSTRAINT "transaction_tags_transaction_id_fkey"
      FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transaction_tags_tag_id_fkey') THEN
    ALTER TABLE "transaction_tags"
      ADD CONSTRAINT "transaction_tags_tag_id_fkey"
      FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cancellation_intents_user_id_fkey') THEN
    ALTER TABLE "cancellation_intents"
      ADD CONSTRAINT "cancellation_intents_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ambassador_profiles_user_id_fkey') THEN
    ALTER TABLE "ambassador_profiles"
      ADD CONSTRAINT "ambassador_profiles_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('fx_rate_observations_from_currency_to_currency_rate_type_eff_id') IS NOT NULL
    AND to_regclass('fx_rate_observations_from_currency_to_currency_rate_type_ef_idx') IS NULL THEN
    ALTER INDEX "fx_rate_observations_from_currency_to_currency_rate_type_eff_id"
      RENAME TO "fx_rate_observations_from_currency_to_currency_rate_type_ef_idx";
  END IF;

  IF to_regclass('fx_rate_observations_from_currency_to_currency_rate_type_obs_id') IS NOT NULL
    AND to_regclass('fx_rate_observations_from_currency_to_currency_rate_type_ob_idx') IS NULL THEN
    ALTER INDEX "fx_rate_observations_from_currency_to_currency_rate_type_obs_id"
      RENAME TO "fx_rate_observations_from_currency_to_currency_rate_type_ob_idx";
  END IF;

  IF to_regclass('fx_rate_overrides_from_currency_to_currency_rate_type_expire_id') IS NOT NULL
    AND to_regclass('fx_rate_overrides_from_currency_to_currency_rate_type_expir_idx') IS NULL THEN
    ALTER INDEX "fx_rate_overrides_from_currency_to_currency_rate_type_expire_id"
      RENAME TO "fx_rate_overrides_from_currency_to_currency_rate_type_expir_idx";
  END IF;

  IF to_regclass('fx_rate_publications_from_currency_to_currency_effective_dat_id') IS NOT NULL
    AND to_regclass('fx_rate_publications_from_currency_to_currency_effective_da_idx') IS NULL THEN
    ALTER INDEX "fx_rate_publications_from_currency_to_currency_effective_dat_id"
      RENAME TO "fx_rate_publications_from_currency_to_currency_effective_da_idx";
  END IF;

  IF to_regclass('fx_rate_publications_from_currency_to_currency_effective_dat_ke') IS NOT NULL
    AND to_regclass('fx_rate_publications_from_currency_to_currency_effective_da_key') IS NULL THEN
    ALTER INDEX "fx_rate_publications_from_currency_to_currency_effective_dat_ke"
      RENAME TO "fx_rate_publications_from_currency_to_currency_effective_da_key";
  END IF;

  IF to_regclass('webhook_delivery_failures_resolved_created_idx') IS NOT NULL
    AND to_regclass('webhook_delivery_failures_resolved_at_created_at_idx') IS NULL THEN
    ALTER INDEX "webhook_delivery_failures_resolved_created_idx"
      RENAME TO "webhook_delivery_failures_resolved_at_created_at_idx";
  END IF;
END $$;
