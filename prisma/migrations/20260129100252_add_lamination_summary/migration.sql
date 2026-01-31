-- Add lamination summary field to slab_optimizations table
-- This stores the summary of lamination strips for 40mm+ pieces

ALTER TABLE "slab_optimizations" ADD COLUMN "laminationSummary" JSONB;
