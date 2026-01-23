import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function seedPricingEntities() {
  console.log('Seeding pricing entities...')

  // Edge Types - Northcoast Stone pricing
  const edgeTypes = [
    { name: 'Pencil Round', category: 'polish', baseRate: new Prisma.Decimal(35.00), sortOrder: 1 },
    { name: 'Bullnose', category: 'polish', baseRate: new Prisma.Decimal(45.00), sortOrder: 2 },
    { name: 'Arriss', category: 'polish', baseRate: new Prisma.Decimal(25.00), sortOrder: 3 },
    { name: 'Waterfall', category: 'waterfall', baseRate: new Prisma.Decimal(85.00), sortOrder: 4 },
    { name: 'Apron', category: 'apron', baseRate: new Prisma.Decimal(95.00), sortOrder: 5 },
  ]

  for (const edge of edgeTypes) {
    await prisma.edgeType.upsert({
      where: { name: edge.name },
      update: edge,
      create: edge,
    })
  }
  console.log(`Seeded ${edgeTypes.length} edge types`)

  // Cutout Types - Northcoast Stone pricing
  const cutoutTypes = [
    { name: 'Undermount Sink', baseRate: new Prisma.Decimal(220.00), sortOrder: 1 },
    { name: 'Drop-in Sink', baseRate: new Prisma.Decimal(180.00), sortOrder: 2 },
    { name: 'Hotplate', baseRate: new Prisma.Decimal(180.00), sortOrder: 3 },
    { name: 'Tap Hole', baseRate: new Prisma.Decimal(45.00), sortOrder: 4 },
    { name: 'Powerpoint Cutout', baseRate: new Prisma.Decimal(65.00), sortOrder: 5 },
    { name: 'Cooktop Cutout', baseRate: new Prisma.Decimal(180.00), sortOrder: 6 },
  ]

  for (const cutout of cutoutTypes) {
    await prisma.cutoutType.upsert({
      where: { name: cutout.name },
      update: cutout,
      create: cutout,
    })
  }
  console.log(`Seeded ${cutoutTypes.length} cutout types`)

  // Thickness Options
  const thicknessOptions = [
    { name: '20mm', value: 20, multiplier: new Prisma.Decimal(1.00), isDefault: true, sortOrder: 1 },
    { name: '40mm', value: 40, multiplier: new Prisma.Decimal(1.30), isDefault: false, sortOrder: 2 },
  ]

  for (const thickness of thicknessOptions) {
    await prisma.thicknessOption.upsert({
      where: { name: thickness.name },
      update: thickness,
      create: thickness,
    })
  }
  console.log(`Seeded ${thicknessOptions.length} thickness options`)

  // Client Types
  const clientTypes = [
    { name: 'Cabinet Maker', description: 'Kitchen and joinery manufacturers', sortOrder: 1 },
    { name: 'Builder', description: 'Residential and commercial builders', sortOrder: 2 },
    { name: 'Direct Consumer', description: 'Homeowners and end consumers', sortOrder: 3 },
    { name: 'Designer/Architect', description: 'Interior designers and architects', sortOrder: 4 },
  ]

  for (const clientType of clientTypes) {
    await prisma.clientType.upsert({
      where: { name: clientType.name },
      update: clientType,
      create: clientType,
    })
  }
  console.log(`Seeded ${clientTypes.length} client types`)

  // Client Tiers
  const clientTiers = [
    { name: 'Tier 1', description: 'Premium partners - best pricing', priority: 100, sortOrder: 1 },
    { name: 'Tier 2', description: 'Regular clients - standard discounts', priority: 50, sortOrder: 2 },
    { name: 'Tier 3', description: 'New clients - standard pricing', priority: 0, isDefault: true, sortOrder: 3 },
  ]

  for (const tier of clientTiers) {
    await prisma.clientTier.upsert({
      where: { name: tier.name },
      update: tier,
      create: tier,
    })
  }
  console.log(`Seeded ${clientTiers.length} client tiers`)

  console.log('Pricing entities seeded successfully!')
}

async function seedPricingRules() {
  console.log('Seeding pricing rules...')

  // Get references
  const cabinetMaker = await prisma.clientType.findUnique({ where: { name: 'Cabinet Maker' } })
  const tier1 = await prisma.clientTier.findUnique({ where: { name: 'Tier 1' } })
  const tier2 = await prisma.clientTier.findUnique({ where: { name: 'Tier 2' } })
  const pencilRound = await prisma.edgeType.findUnique({ where: { name: 'Pencil Round' } })

  if (!cabinetMaker || !tier1 || !tier2) {
    console.log('⚠️ Skipping pricing rules - base entities not found')
    return
  }

  // Rule 1: Tier 1 gets 15% off everything
  await prisma.pricingRule.upsert({
    where: { id: 'rule-tier1-discount' },
    update: {},
    create: {
      id: 'rule-tier1-discount',
      name: 'Tier 1 - 15% Discount',
      description: 'Premium partners receive 15% off all pricing',
      priority: 100,
      clientTierId: tier1.id,
      adjustmentType: 'percentage',
      adjustmentValue: new Prisma.Decimal(-15.00),
      appliesTo: 'all',
    },
  })

  // Rule 2: Tier 2 gets 10% off materials only
  await prisma.pricingRule.upsert({
    where: { id: 'rule-tier2-materials' },
    update: {},
    create: {
      id: 'rule-tier2-materials',
      name: 'Tier 2 - 10% Off Materials',
      description: 'Regular clients receive 10% off material costs',
      priority: 50,
      clientTierId: tier2.id,
      adjustmentType: 'percentage',
      adjustmentValue: new Prisma.Decimal(-10.00),
      appliesTo: 'materials',
    },
  })

  // Rule 3: Cabinet Makers get special edge pricing
  if (pencilRound) {
    const cmRule = await prisma.pricingRule.upsert({
      where: { id: 'rule-cm-edges' },
      update: {},
      create: {
        id: 'rule-cm-edges',
        name: 'Cabinet Maker - Edge Discount',
        description: 'Cabinet makers get reduced edge polish rates',
        priority: 50,
        clientTypeId: cabinetMaker.id,
        adjustmentType: 'percentage',
        adjustmentValue: new Prisma.Decimal(0), // No general adjustment
        appliesTo: 'edges',
      },
    })

    // Add specific edge override: Pencil Round at $30/lm instead of $35
    await prisma.pricingRuleEdge.upsert({
      where: {
        pricingRuleId_edgeTypeId: {
          pricingRuleId: cmRule.id,
          edgeTypeId: pencilRound.id,
        },
      },
      update: {},
      create: {
        pricingRuleId: cmRule.id,
        edgeTypeId: pencilRound.id,
        customRate: new Prisma.Decimal(30.00),
      },
    })
  }

  // Rule 4: Large quotes get additional discount
  await prisma.pricingRule.upsert({
    where: { id: 'rule-large-quote' },
    update: {},
    create: {
      id: 'rule-large-quote',
      name: 'Large Quote Discount',
      description: 'Quotes over $10,000 receive 5% additional discount',
      priority: 25,
      minQuoteValue: new Prisma.Decimal(10000.00),
      adjustmentType: 'percentage',
      adjustmentValue: new Prisma.Decimal(-5.00),
      appliesTo: 'all',
    },
  })

  console.log('✓ Seeded 4 pricing rules')
}

// Run both seeders
async function main() {
  await seedPricingEntities()
  await seedPricingRules()
}

main()
  .catch((e) => {
    console.error('Error seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
