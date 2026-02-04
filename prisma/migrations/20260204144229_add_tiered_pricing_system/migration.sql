-- CreateEnum
CREATE TYPE "DiscountCategory" AS ENUM ('SLAB', 'CUTTING', 'POLISHING', 'CUTOUT', 'DELIVERY', 'INSTALLATION', 'OTHER');

-- CreateEnum
CREATE TYPE "DiscountDisplayMode" AS ENUM ('TOTAL_ONLY', 'ITEMIZED');

-- CreateTable
CREATE TABLE "price_tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "organisation_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tier_discount_rules" (
    "id" TEXT NOT NULL,
    "tier_id" TEXT NOT NULL,
    "category" "DiscountCategory" NOT NULL,
    "discount_percent" DOUBLE PRECISION NOT NULL,
    "is_excluded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tier_discount_rules_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add priceTierId to customers
ALTER TABLE "customers" ADD COLUMN "price_tier_id" TEXT;

-- AlterTable: Add priceTierId, managerReviewRequired, discountDisplayMode to quotes
ALTER TABLE "quotes" ADD COLUMN "price_tier_id" TEXT;
ALTER TABLE "quotes" ADD COLUMN "manager_review_required" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "quotes" ADD COLUMN "discount_display_mode" "DiscountDisplayMode" NOT NULL DEFAULT 'TOTAL_ONLY';

-- CreateIndex
CREATE INDEX "price_tiers_organisation_id_idx" ON "price_tiers"("organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "price_tiers_organisation_id_name_key" ON "price_tiers"("organisation_id", "name");

-- CreateIndex
CREATE INDEX "tier_discount_rules_tier_id_idx" ON "tier_discount_rules"("tier_id");

-- CreateIndex
CREATE UNIQUE INDEX "tier_discount_rules_tier_id_category_key" ON "tier_discount_rules"("tier_id", "category");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_price_tier_id_fkey" FOREIGN KEY ("price_tier_id") REFERENCES "price_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_price_tier_id_fkey" FOREIGN KEY ("price_tier_id") REFERENCES "price_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tier_discount_rules" ADD CONSTRAINT "tier_discount_rules_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "price_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
