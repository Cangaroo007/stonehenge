import { PrismaClient, ServiceType, RateUnit } from '@prisma/client';
const prisma = new PrismaClient();

async function seedServiceRates() {
  console.log('🌱 Seeding ServiceRates...');

  const serviceRates = [
    {
      serviceType: ServiceType.CUTTING,
      name: 'Cutting',
      description: 'Cutting stone to shape - calculated on full perimeter',
      rate20mm: 17.50,
      rate40mm: 45.00,
      unit: RateUnit.LINEAR_METER,
      minimumCharge: null,
      minimumQty: null,
      isActive: true
    },
    {
      serviceType: ServiceType.POLISHING,
      name: 'Polishing (Base)',
      description: 'Base polishing rate - calculated on finished edges only',
      rate20mm: 45.00,
      rate40mm: 115.00,
      unit: RateUnit.LINEAR_METER,
      minimumCharge: null,
      minimumQty: null,
      isActive: true
    },
    {
      serviceType: ServiceType.INSTALLATION,
      name: 'Installation',
      description: 'On-site installation - calculated on piece area',
      rate20mm: 140.00,
      rate40mm: 170.00,
      unit: RateUnit.SQUARE_METER,
      minimumCharge: null,
      minimumQty: null,
      isActive: true
    },
    {
      serviceType: ServiceType.WATERFALL_END,
      name: 'Waterfall End',
      description: 'Waterfall edge treatment - fixed per item',
      rate20mm: 300.00,
      rate40mm: 650.00,
      unit: RateUnit.FIXED,
      minimumCharge: null,
      minimumQty: null,
      isActive: true
    }
  ] as const;

  for (const rate of serviceRates) {
    await prisma.serviceRate.upsert({
      where: { serviceType: rate.serviceType },
      update: {
        name: rate.name,
        description: rate.description,
        rate20mm: rate.rate20mm,
        rate40mm: rate.rate40mm,
        unit: rate.unit,
        minimumCharge: rate.minimumCharge,
        minimumQty: rate.minimumQty,
        isActive: rate.isActive
      },
      create: rate
    });
    console.log(`  ✅ ${rate.name} (${rate.serviceType})`);
  }

  console.log('✅ ServiceRates seeded successfully\n');
}

seedServiceRates()
  .catch((e) => {
    console.error('❌ Error seeding service rates:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
