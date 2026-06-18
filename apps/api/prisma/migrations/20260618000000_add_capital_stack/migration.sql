-- Owner–Operator Capital Stack (RFC-6 Phase 1)
-- Adds capital purpose on accounts, entity group extensions, journals, Karafiel bridge audit.

-- HouseholdType: owner_operator
ALTER TYPE "HouseholdType" ADD VALUE IF NOT EXISTS 'owner_operator';

CREATE TYPE "CapitalPurpose" AS ENUM (
  'personal_life',
  'owner_facility',
  'entity_operating',
  'equity_stake'
);

CREATE TYPE "OwnerCapitalFlowType" AS ENUM (
  'capital_contribution',
  'shareholder_loan',
  'loan_repayment',
  'owner_draw',
  'distribution'
);

CREATE TYPE "OwnerCapitalJournalStatus" AS ENUM (
  'draft',
  'proposed',
  'matched',
  'compliance_pending',
  'compliance_sealed',
  'manual_review',
  'void'
);

CREATE TYPE "ComplianceBridgeDirection" AS ENUM (
  'dhanam_to_karafiel',
  'karafiel_to_dhanam'
);

CREATE TYPE "ComplianceBridgeResolution" AS ENUM (
  'auto',
  'manual',
  'skipped'
);

ALTER TABLE "households"
  ADD COLUMN IF NOT EXISTS "beneficial_owner_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE INDEX IF NOT EXISTS "households_beneficial_owner_user_id_idx"
  ON "households" ("beneficial_owner_user_id");
CREATE INDEX IF NOT EXISTS "households_type_idx" ON "households" ("type");

ALTER TABLE "households"
  ADD CONSTRAINT "households_beneficial_owner_user_id_fkey"
  FOREIGN KEY ("beneficial_owner_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounts"
  ADD COLUMN IF NOT EXISTS "capital_purpose" "CapitalPurpose" NOT NULL DEFAULT 'personal_life';

CREATE INDEX IF NOT EXISTS "accounts_space_id_capital_purpose_idx"
  ON "accounts" ("space_id", "capital_purpose");

CREATE TABLE IF NOT EXISTS "space_operator_bindings" (
  "id" TEXT NOT NULL,
  "space_id" TEXT NOT NULL,
  "operator_user_id" TEXT NOT NULL,
  "beneficial_owner_user_id" TEXT NOT NULL,
  "legal_name" TEXT NOT NULL,
  "tax_id" TEXT NOT NULL,
  "ownership_percent" DECIMAL(5, 2) NOT NULL DEFAULT 100,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "space_operator_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "space_operator_bindings_space_id_key"
  ON "space_operator_bindings" ("space_id");
CREATE INDEX IF NOT EXISTS "space_operator_bindings_operator_user_id_idx"
  ON "space_operator_bindings" ("operator_user_id");
CREATE INDEX IF NOT EXISTS "space_operator_bindings_beneficial_owner_user_id_idx"
  ON "space_operator_bindings" ("beneficial_owner_user_id");

ALTER TABLE "space_operator_bindings"
  ADD CONSTRAINT "space_operator_bindings_space_id_fkey"
  FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "space_operator_bindings"
  ADD CONSTRAINT "space_operator_bindings_operator_user_id_fkey"
  FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "space_operator_bindings"
  ADD CONSTRAINT "space_operator_bindings_beneficial_owner_user_id_fkey"
  FOREIGN KEY ("beneficial_owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "owner_capital_journals" (
  "id" TEXT NOT NULL,
  "entity_group_id" TEXT NOT NULL,
  "flow_type" "OwnerCapitalFlowType" NOT NULL,
  "status" "OwnerCapitalJournalStatus" NOT NULL DEFAULT 'draft',
  "source_space_id" TEXT,
  "target_space_id" TEXT,
  "source_transaction_id" TEXT,
  "target_transaction_id" TEXT,
  "amount" DECIMAL(19, 4) NOT NULL,
  "currency" "Currency" NOT NULL,
  "running_balance_minor" BIGINT,
  "detection_confidence" DECIMAL(4, 3),
  "karafiel_case_id" TEXT,
  "compliance_record_id" TEXT,
  "created_by_user_id" TEXT,
  "notes" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "owner_capital_journals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "owner_capital_journals_entity_group_id_status_idx"
  ON "owner_capital_journals" ("entity_group_id", "status");
CREATE INDEX IF NOT EXISTS "owner_capital_journals_entity_group_id_flow_type_idx"
  ON "owner_capital_journals" ("entity_group_id", "flow_type");
CREATE INDEX IF NOT EXISTS "owner_capital_journals_source_transaction_id_idx"
  ON "owner_capital_journals" ("source_transaction_id");
CREATE INDEX IF NOT EXISTS "owner_capital_journals_target_transaction_id_idx"
  ON "owner_capital_journals" ("target_transaction_id");
CREATE INDEX IF NOT EXISTS "owner_capital_journals_karafiel_case_id_idx"
  ON "owner_capital_journals" ("karafiel_case_id");
CREATE INDEX IF NOT EXISTS "owner_capital_journals_created_at_idx"
  ON "owner_capital_journals" ("created_at" DESC);

ALTER TABLE "owner_capital_journals"
  ADD CONSTRAINT "owner_capital_journals_entity_group_id_fkey"
  FOREIGN KEY ("entity_group_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "owner_capital_journals"
  ADD CONSTRAINT "owner_capital_journals_source_space_id_fkey"
  FOREIGN KEY ("source_space_id") REFERENCES "spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "owner_capital_journals"
  ADD CONSTRAINT "owner_capital_journals_target_space_id_fkey"
  FOREIGN KEY ("target_space_id") REFERENCES "spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "owner_capital_journals"
  ADD CONSTRAINT "owner_capital_journals_source_transaction_id_fkey"
  FOREIGN KEY ("source_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "owner_capital_journals"
  ADD CONSTRAINT "owner_capital_journals_target_transaction_id_fkey"
  FOREIGN KEY ("target_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "owner_capital_journals"
  ADD CONSTRAINT "owner_capital_journals_compliance_record_id_fkey"
  FOREIGN KEY ("compliance_record_id") REFERENCES "compliance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "owner_capital_journals"
  ADD CONSTRAINT "owner_capital_journals_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "compliance_bridge_events" (
  "id" TEXT NOT NULL,
  "journal_id" TEXT,
  "direction" "ComplianceBridgeDirection" NOT NULL,
  "event_type" TEXT NOT NULL,
  "correlation_id" TEXT NOT NULL,
  "resolution" "ComplianceBridgeResolution" NOT NULL DEFAULT 'auto',
  "payload" JSONB,
  "resolved_by" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "compliance_bridge_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "compliance_bridge_events_journal_id_idx"
  ON "compliance_bridge_events" ("journal_id");
CREATE INDEX IF NOT EXISTS "compliance_bridge_events_correlation_id_idx"
  ON "compliance_bridge_events" ("correlation_id");
CREATE INDEX IF NOT EXISTS "compliance_bridge_events_event_type_idx"
  ON "compliance_bridge_events" ("event_type");
CREATE INDEX IF NOT EXISTS "compliance_bridge_events_created_at_idx"
  ON "compliance_bridge_events" ("created_at" DESC);

ALTER TABLE "compliance_bridge_events"
  ADD CONSTRAINT "compliance_bridge_events_journal_id_fkey"
  FOREIGN KEY ("journal_id") REFERENCES "owner_capital_journals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
