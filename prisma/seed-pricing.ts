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

seedPricingEntities()
  .catch((e) => {
    console.error('Error seeding pricing entities:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
