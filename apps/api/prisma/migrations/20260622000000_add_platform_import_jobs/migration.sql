-- Platform import jobs for competitor migration wizards (PM-1)

CREATE TYPE "PlatformImportSource" AS ENUM ('lunchmoney', 'csv');
CREATE TYPE "PlatformImportStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

CREATE TABLE "platform_import_jobs" (
    "id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" "PlatformImportSource" NOT NULL,
    "status" "PlatformImportStatus" NOT NULL DEFAULT 'pending',
    "bullmq_job_id" TEXT,
    "encrypted_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "start_date" TEXT,
    "options" JSONB,
    "preflight_summary" JSONB,
    "result_summary" JSONB,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_import_jobs_space_id_created_at_idx" ON "platform_import_jobs"("space_id", "created_at" DESC);
CREATE INDEX "platform_import_jobs_user_id_created_at_idx" ON "platform_import_jobs"("user_id", "created_at" DESC);
CREATE INDEX "platform_import_jobs_status_idx" ON "platform_import_jobs"("status");

ALTER TABLE "platform_import_jobs" ADD CONSTRAINT "platform_import_jobs_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_import_jobs" ADD CONSTRAINT "platform_import_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
