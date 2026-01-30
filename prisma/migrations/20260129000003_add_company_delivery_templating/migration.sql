-- Create companies table
CREATE TABLE IF NOT EXISTS "companies" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "abn" TEXT,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "workshop_address" TEXT NOT NULL,
    "logo_url" TEXT,
    "default_tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- Add companyId to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_id" INTEGER;
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_company_id_fkey'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Create delivery_zones table
CREATE TABLE IF NOT EXISTS "delivery_zones" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "max_distance_km" INTEGER NOT NULL,
    "rate_per_km" DECIMAL(10,2) NOT NULL,
    "base_charge" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "delivery_zones_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_zones_company_id_name_key" ON "delivery_zones"("company_id", "name");

-- Create templating_rates table
CREATE TABLE IF NOT EXISTS "templating_rates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Standard Templating',
    "base_charge" DECIMAL(10,2) NOT NULL,
    "rate_per_km" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "templating_rates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "templating_rates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Add delivery and templating fields to quotes table
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "delivery_address" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "delivery_distance_km" DECIMAL(10,2);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "delivery_zone_id" INTEGER;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "delivery_cost" DECIMAL(10,2);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "templating_required" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "templating_distance_km" DECIMAL(10,2);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "templating_cost" DECIMAL(10,2);

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotes_delivery_zone_id_fkey'
  ) THEN
    ALTER TABLE "quotes" ADD CONSTRAINT "quotes_delivery_zone_id_fkey" FOREIGN KEY ("delivery_zone_id") REFERENCES "delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add companyId to price_books table
ALTER TABLE "price_books" ADD COLUMN IF NOT EXISTS "company_id" INTEGER;
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'price_books_company_id_fkey'
  ) THEN
    ALTER TABLE "price_books" ADD CONSTRAINT "price_books_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
