-- CreateEnum
CREATE TYPE "AccountingProvider" AS ENUM ('XERO', 'MYOB');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR');

-- CreateTable
CREATE TABLE "accounting_connections" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "connected_by_user_id" INTEGER NOT NULL,
    "provider" "AccountingProvider" NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "external_tenant_id" TEXT,
    "external_tenant_name" TEXT,
    "access_token_enc" TEXT NOT NULL,
    "refresh_token_enc" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matter_reference" TEXT,
    "matter_name" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounting_connections_company_id_idx" ON "accounting_connections"("company_id");

-- CreateIndex
CREATE INDEX "accounting_connections_connected_by_user_id_idx" ON "accounting_connections"("connected_by_user_id");

-- CreateIndex
CREATE INDEX "accounting_connections_status_idx" ON "accounting_connections"("status");

-- CreateIndex (unique composite)
CREATE UNIQUE INDEX "accounting_connections_company_id_provider_external_tenant_id_key" ON "accounting_connections"("company_id", "provider", "external_tenant_id");

-- AddForeignKey
ALTER TABLE "accounting_connections" ADD CONSTRAINT "accounting_connections_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_connections" ADD CONSTRAINT "accounting_connections_connected_by_user_id_fkey" FOREIGN KEY ("connected_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
