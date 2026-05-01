-- Migration: add_compliance_records
-- Purpose: Adds ComplianceRecord table for document ingestion, Karafiel one-to-one
--          compliance sealing, and tier-based retention policy tracking.
-- Applied via: CI pipeline (enclii deploy → prisma migrate deploy)

CREATE TABLE "compliance_records" (
    "id"               TEXT          NOT NULL,
    "document_key"     TEXT          NOT NULL,
    "space_id"         TEXT          NOT NULL,
    "karafiel_id"      TEXT,
    "retention_policy" TEXT          NOT NULL,
    "extraction_state" TEXT          NOT NULL,
    "sealed_at"        TIMESTAMP(3),
    "created_at"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_records_pkey" PRIMARY KEY ("id")
);

-- Unique indices
CREATE UNIQUE INDEX "compliance_records_document_key_key" ON "compliance_records"("document_key");
CREATE UNIQUE INDEX "compliance_records_karafiel_id_key"  ON "compliance_records"("karafiel_id");

-- Lookup index by space
CREATE INDEX "compliance_records_space_id_idx" ON "compliance_records"("space_id");
