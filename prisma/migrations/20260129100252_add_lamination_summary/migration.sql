-- Add lamination summary field to SlabOptimization table
-- This stores the summary of lamination strips for 40mm+ pieces

ALTER TABLE "SlabOptimization" ADD COLUMN "laminationSummary" JSONB;
