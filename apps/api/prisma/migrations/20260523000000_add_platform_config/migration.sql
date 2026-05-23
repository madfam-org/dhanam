-- CreateEnum
CREATE TYPE "PlatformConfigScope" AS ENUM ('platform', 'org');

-- CreateTable
CREATE TABLE "platform_config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" "PlatformConfigScope" NOT NULL DEFAULT 'platform',
    "scope_id" TEXT NOT NULL DEFAULT '',
    "value" JSONB NOT NULL,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_config_key_scope_scope_id_key" ON "platform_config"("key", "scope", "scope_id");

-- CreateIndex
CREATE INDEX "platform_config_scope_scope_id_idx" ON "platform_config"("scope", "scope_id");

-- AddForeignKey
ALTER TABLE "platform_config" ADD CONSTRAINT "platform_config_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
