-- Fix incorrect default slab dimensions in slab_optimizations table.
-- Previous defaults of 3000×1400mm were wrong — Australian standard is 3200×1600mm
-- for Engineered Quartz (Jumbo), which is the most common material type.

ALTER TABLE "slab_optimizations" ALTER COLUMN "slabWidth" SET DEFAULT 3200;
ALTER TABLE "slab_optimizations" ALTER COLUMN "slabHeight" SET DEFAULT 1600;
