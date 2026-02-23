/**
 * Fix incorrect slab dimensions on Material records.
 *
 * The initial import set all materials to 3000mm slab sizes. This script
 * corrects them using Australian supplier standard dimensions, inferred
 * from material name keywords where possible.
 *
 * Run: npx tsx prisma/fix-slab-sizes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SlabDims {
  length: number;
  width: number;
  label: string;
}

// Australian standard slab dimensions by material type
const DIMS = {
  ENGINEERED_JUMBO: { length: 3200, width: 1600, label: 'Engineered Quartz (Jumbo)' },
  ENGINEERED_STANDARD: { length: 3050, width: 1440, label: 'Engineered Quartz (Standard)' },
  NATURAL_STONE: { length: 2800, width: 1600, label: 'Natural Stone' },
  SINTERED: { length: 3200, width: 1600, label: 'Porcelain / Sintered' },
} satisfies Record<string, SlabDims>;

// Keywords that identify sintered/porcelain materials by name
const SINTERED_KEYWORDS = ['dekton', 'neolith', 'lapitec', 'laminam', 'sinterstone', 'porcelain', 'sintered'];
// Keywords that identify natural stone by name
const NATURAL_KEYWORDS = ['granite', 'marble', 'quartzite', 'travertine', 'limestone', 'onyx', 'sandstone', 'slate'];
// Keywords that suggest standard (non-jumbo) engineered quartz
const STANDARD_KEYWORDS = ['essastone', 'compac', 'silestone standard'];

function classifyMaterial(name: string, collection: string | null): SlabDims {
  const combined = `${name} ${collection ?? ''}`.toLowerCase();

  if (SINTERED_KEYWORDS.some((kw) => combined.includes(kw))) return DIMS.SINTERED;
  if (NATURAL_KEYWORDS.some((kw) => combined.includes(kw))) return DIMS.NATURAL_STONE;
  if (STANDARD_KEYWORDS.some((kw) => combined.includes(kw))) return DIMS.ENGINEERED_STANDARD;

  // Default: Engineered Quartz Jumbo (Caesarstone, Silestone, Smartstone, etc.)
  return DIMS.ENGINEERED_JUMBO;
}

async function main() {
  console.log('🔍 Fetching all materials...');

  const materials = await prisma.material.findMany({
    select: { id: true, name: true, collection: true, slabLengthMm: true, slabWidthMm: true },
    orderBy: { name: 'asc' },
  });

  console.log(`Found ${materials.length} materials\n`);

  let updated = 0;
  let skipped = 0;

  for (const mat of materials) {
    const isWrong =
      mat.slabLengthMm === 3000 ||
      mat.slabWidthMm === 3000 ||
      mat.slabLengthMm === null ||
      mat.slabWidthMm === null;

    if (!isWrong) {
      console.log(`  ⏭  ${mat.name} — already set to ${mat.slabLengthMm}×${mat.slabWidthMm}mm`);
      skipped++;
      continue;
    }

    const dims = classifyMaterial(mat.name, mat.collection);

    await prisma.material.update({
      where: { id: mat.id },
      data: { slabLengthMm: dims.length, slabWidthMm: dims.width },
    });

    console.log(`  ✅ ${mat.name} → ${dims.length}×${dims.width}mm  (${dims.label})`);
    updated++;
  }

  console.log(`\n📊 Summary: ${updated} updated, ${skipped} already correct`);
}

main()
  .catch((err) => {
    console.error('❌ Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
