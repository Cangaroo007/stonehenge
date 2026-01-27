import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ============================================
  // CREATE DEMO USER
  // ============================================
  const passwordHash = await bcrypt.hash('demo1234', 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'admin@northcoaststone.com.au' },
    update: {},
    create: {
      email: 'admin@northcoaststone.com.au',
      passwordHash,
      name: 'Admin User',
    },
  });
  console.log('✅ Created user:', user.email);

  // ============================================
  // CREATE MATERIALS
  // ============================================
  const materials = [
    { name: 'Alpha Zero', collection: 'Classic Collection', pricePerSqm: 450 },
    { name: 'Calacatta Nuvo', collection: 'Premium Collection', pricePerSqm: 650 },
    { name: 'Statuario Maximus', collection: 'Premium Collection', pricePerSqm: 720 },
    { name: 'Pure White', collection: 'Classic Collection', pricePerSqm: 380 },
    { name: 'Jet Black', collection: 'Classic Collection', pricePerSqm: 420 },
    { name: 'Empira White', collection: 'Designer Collection', pricePerSqm: 550 },
    { name: 'Empira Black', collection: 'Designer Collection', pricePerSqm: 550 },
    { name: 'Turbine Grey', collection: 'Industrial Collection', pricePerSqm: 480 },
    { name: 'Concrete', collection: 'Industrial Collection', pricePerSqm: 420 },
    { name: 'Cloudburst Concrete', collection: 'Industrial Collection', pricePerSqm: 460 },
  ];

  for (const mat of materials) {
    await prisma.material.upsert({
      where: { id: materials.indexOf(mat) + 1 },
      update: mat,
      create: mat,
    });
  }
  console.log('✅ Created', materials.length, 'materials');

  // ============================================
  // CREATE FEATURE PRICING (Simple key-value pricing)
  // ============================================
  const featurePricing = [
    // Thickness multipliers
    { category: 'thickness', name: '20mm', price: 1.0, priceType: 'multiplier', description: 'Standard 20mm thickness' },
    { category: 'thickness', name: '30mm', price: 1.3, priceType: 'multiplier', description: '30mm thickness' },
    { category: 'thickness', name: '40mm', price: 1.5, priceType: 'multiplier', description: '40mm thickness (mitered)' },

    // Edge profiles
    { category: 'edge', name: 'Pencil Round', price: 0, priceType: 'per_meter', description: 'Standard pencil round edge' },
    { category: 'edge', name: 'Bullnose', price: 45, priceType: 'per_meter', description: 'Full bullnose edge' },
    { category: 'edge', name: 'Beveled', price: 35, priceType: 'per_meter', description: '45 degree bevel' },
    { category: 'edge', name: 'Ogee', price: 65, priceType: 'per_meter', description: 'Decorative ogee profile' },
    { category: 'edge', name: 'Square/Eased', price: 0, priceType: 'per_meter', description: 'Square edge with slight ease' },
    { category: 'edge', name: 'Mitered', price: 85, priceType: 'per_meter', description: 'Mitered edge for thick appearance' },

    // Cutouts
    { category: 'cutout', name: 'Undermount Sink Cutout', price: 180, priceType: 'fixed', description: 'Cutout for undermount sink' },
    { category: 'cutout', name: 'Drop-in Sink Cutout', price: 120, priceType: 'fixed', description: 'Cutout for drop-in sink' },
    { category: 'cutout', name: 'Cooktop/Hotplate Cutout', price: 150, priceType: 'fixed', description: 'Cutout for cooktop or hotplate' },
    { category: 'cutout', name: 'Basin Cutout', price: 95, priceType: 'fixed', description: 'Cutout for basin' },
    { category: 'cutout', name: 'Tap Hole', price: 35, priceType: 'fixed', description: 'Single tap hole' },
    { category: 'cutout', name: 'GPO/Powerpoint Cutout', price: 45, priceType: 'fixed', description: 'Cutout for electrical outlet' },

    // Features
    { category: 'feature', name: 'Waterfall End', price: 350, priceType: 'fixed', description: 'Waterfall return on island end' },
    { category: 'feature', name: 'Splashback (per sqm)', price: 380, priceType: 'per_sqm', description: 'Matching stone splashback' },
    { category: 'feature', name: 'Undermount Sink Polish', price: 85, priceType: 'fixed', description: 'Polish undermount sink cutout' },
    { category: 'feature', name: 'Corner Join', price: 120, priceType: 'fixed', description: 'L-shaped corner join' },
    { category: 'feature', name: 'Radius Corner', price: 65, priceType: 'fixed', description: 'Rounded corner' },
  ];

  for (const pricing of featurePricing) {
    await prisma.featurePricing.upsert({
      where: { id: featurePricing.indexOf(pricing) + 1 },
      update: pricing,
      create: pricing,
    });
  }
  console.log('✅ Created', featurePricing.length, 'feature pricing entries');

  // ============================================
  // CREATE EDGE TYPES (for EdgeSelector component)
  // ============================================
  const edgeTypes = [
    { name: 'Pencil Round', description: 'Standard pencil round edge', category: 'polish', baseRate: 35, sortOrder: 1, isActive: true },
    { name: 'Bullnose', description: 'Full bullnose edge', category: 'polish', baseRate: 45, sortOrder: 2, isActive: true },
    { name: 'Arriss', description: 'Slight ease/chamfer on edge', category: 'polish', baseRate: 25, sortOrder: 3, isActive: true },
    { name: 'Beveled', description: '45 degree bevel', category: 'polish', baseRate: 40, sortOrder: 4, isActive: true },
    { name: 'Ogee', description: 'Decorative ogee profile', category: 'polish', baseRate: 65, sortOrder: 5, isActive: true },
    { name: 'Square/Eased', description: 'Square edge with slight ease', category: 'polish', baseRate: 30, sortOrder: 6, isActive: true },
    { name: 'Mitered', description: 'Mitered edge for thick appearance', category: 'polish', baseRate: 85, sortOrder: 7, isActive: true },
    { name: 'Waterfall', description: 'Waterfall edge return', category: 'waterfall', baseRate: 120, sortOrder: 8, isActive: true },
  ];

  for (const edgeType of edgeTypes) {
    await prisma.edgeType.upsert({
      where: { name: edgeType.name },
      update: edgeType,
      create: edgeType,
    });
  }
  console.log('✅ Created', edgeTypes.length, 'edge types');

  // ============================================
  // CREATE CUTOUT TYPES (for CutoutSelector component)
  // ============================================
  const cutoutTypes = [
    { name: 'Undermount Sink', description: 'Cutout for undermount sink', baseRate: 180, sortOrder: 1, isActive: true },
    { name: 'Drop-in Sink', description: 'Cutout for drop-in sink', baseRate: 120, sortOrder: 2, isActive: true },
    { name: 'Cooktop/Hotplate', description: 'Cutout for cooktop or hotplate', baseRate: 150, sortOrder: 3, isActive: true },
    { name: 'Basin', description: 'Cutout for basin', baseRate: 95, sortOrder: 4, isActive: true },
    { name: 'Tap Hole', description: 'Single tap hole', baseRate: 35, sortOrder: 5, isActive: true },
    { name: 'GPO/Powerpoint', description: 'Cutout for electrical outlet', baseRate: 45, sortOrder: 6, isActive: true },
  ];

  for (const cutoutType of cutoutTypes) {
    await prisma.cutoutType.upsert({
      where: { name: cutoutType.name },
      update: cutoutType,
      create: cutoutType,
    });
  }
  console.log('✅ Created', cutoutTypes.length, 'cutout types');

  // ============================================
  // CREATE THICKNESS OPTIONS (for Thickness selector)
  // ============================================
  const thicknessOptions = [
    { name: '20mm', value: 20, multiplier: 1.00, isDefault: true, sortOrder: 1, isActive: true },
    { name: '40mm', value: 40, multiplier: 1.30, isDefault: false, sortOrder: 2, isActive: true },
  ];

  for (const thickness of thicknessOptions) {
    await prisma.thicknessOption.upsert({
      where: { name: thickness.name },
      update: thickness,
      create: thickness,
    });
  }
  console.log('✅ Created', thicknessOptions.length, 'thickness options');

  // ============================================
  // CREATE CLIENT TYPES (for customer classification)
  // ============================================
  const clientTypes = [
    { name: 'Cabinet Maker', description: 'Kitchen and joinery manufacturers', sortOrder: 1, isActive: true },
    { name: 'Builder', description: 'Residential and commercial builders', sortOrder: 2, isActive: true },
    { name: 'Direct Consumer', description: 'Homeowners and end consumers', sortOrder: 3, isActive: true },
    { name: 'Designer/Architect', description: 'Interior designers and architects', sortOrder: 4, isActive: true },
  ];

  for (const clientType of clientTypes) {
    await prisma.clientType.upsert({
      where: { name: clientType.name },
      update: clientType,
      create: clientType,
    });
  }
  console.log('✅ Created', clientTypes.length, 'client types');

  // ============================================
  // CREATE CLIENT TIERS (for pricing tiers)
  // ============================================
  const clientTiers = [
    { name: 'Tier 1', description: 'Premium partners - best pricing', priority: 100, sortOrder: 1, isActive: true },
    { name: 'Tier 2', description: 'Regular clients - standard discounts', priority: 50, sortOrder: 2, isActive: true },
    { name: 'Tier 3', description: 'New clients - standard pricing', priority: 0, isDefault: true, sortOrder: 3, isActive: true },
  ];

  for (const tier of clientTiers) {
    await prisma.clientTier.upsert({
      where: { name: tier.name },
      update: tier,
      create: tier,
    });
  }
  console.log('✅ Created', clientTiers.length, 'client tiers');

  // ============================================
  // CREATE DEMO CUSTOMERS
  // ============================================
  const customers = [
    {
      name: 'Gem Life',
      company: 'GemLife Highfields Heights',
      email: 'projects@gemlife.com.au',
      phone: '07 5555 1234',
      address: 'Highfields Heights, QLD',
    },
    {
      name: 'John Smith',
      company: 'Smith Building Co',
      email: 'john@smithbuilding.com.au',
      phone: '0412 345 678',
      address: '123 Main St, Brisbane QLD 4000',
    },
    {
      name: 'Sarah Johnson',
      company: null,
      email: 'sarah.j@email.com',
      phone: '0423 456 789',
      address: '45 Ocean View Dr, Sunshine Coast QLD 4556',
    },
  ];

  for (const cust of customers) {
    await prisma.customer.upsert({
      where: { id: customers.indexOf(cust) + 1 },
      update: cust,
      create: cust,
    });
  }
  console.log('✅ Created', customers.length, 'customers');

  // ============================================
  // CREATE DEMO QUOTE
  // ============================================
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: 'Q-00001',
      customerId: 1,
      projectName: 'Moreton Bay Stage 2 - Villa 48',
      projectAddress: 'Villa 48, Highfields Heights, QLD',
      status: 'draft',
      subtotal: 6818.00,
      taxRate: 10,
      taxAmount: 681.80,
      total: 7499.80,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      notes: 'This Quote is based on the proviso that all stonework is the same colour and fabricated and installed at the same time.',
      createdBy: 1,
      rooms: {
        create: [
          {
            name: 'Kitchen',
            sortOrder: 1,
            pieces: {
              create: [
                {
                  description: 'Island Bench with waterfall ends',
                  lengthMm: 2700,
                  widthMm: 900,
                  thicknessMm: 40,
                  areaSqm: 2.43,
                  materialId: 1,
                  materialName: 'Alpha Zero',
                  materialCost: 1640.25,
                  featuresCost: 880.00,
                  totalCost: 2520.25,
                  sortOrder: 1,
                  features: {
                    create: [
                      { name: 'Waterfall End', quantity: 2, unitPrice: 350, totalPrice: 700 },
                      { name: 'Undermount Sink Cutout', quantity: 1, unitPrice: 180, totalPrice: 180 },
                    ],
                  },
                },
                {
                  description: 'Back Bench',
                  lengthMm: 1990,
                  widthMm: 650,
                  thicknessMm: 40,
                  areaSqm: 1.29,
                  materialId: 1,
                  materialName: 'Alpha Zero',
                  materialCost: 870.75,
                  featuresCost: 150.00,
                  totalCost: 1020.75,
                  sortOrder: 2,
                  features: {
                    create: [
                      { name: 'Cooktop/Hotplate Cutout', quantity: 1, unitPrice: 150, totalPrice: 150 },
                    ],
                  },
                },
              ],
            },
          },
          {
            name: 'Pantry',
            sortOrder: 2,
            pieces: {
              create: [
                {
                  description: 'Pantry Bench 1',
                  lengthMm: 1527,
                  widthMm: 600,
                  thicknessMm: 20,
                  areaSqm: 0.92,
                  materialId: 1,
                  materialName: 'Alpha Zero',
                  materialCost: 414.00,
                  featuresCost: 0,
                  totalCost: 414.00,
                  sortOrder: 1,
                },
                {
                  description: 'Pantry Bench 2',
                  lengthMm: 1527,
                  widthMm: 600,
                  thicknessMm: 20,
                  areaSqm: 0.92,
                  materialId: 1,
                  materialName: 'Alpha Zero',
                  materialCost: 414.00,
                  featuresCost: 0,
                  totalCost: 414.00,
                  sortOrder: 2,
                },
              ],
            },
          },
          {
            name: 'Laundry',
            sortOrder: 3,
            pieces: {
              create: [
                {
                  description: 'Laundry Bench',
                  lengthMm: 1000,
                  widthMm: 600,
                  thicknessMm: 20,
                  areaSqm: 0.60,
                  materialId: 1,
                  materialName: 'Alpha Zero',
                  materialCost: 270.00,
                  featuresCost: 120.00,
                  totalCost: 390.00,
                  sortOrder: 1,
                  features: {
                    create: [
                      { name: 'Drop-in Sink Cutout', quantity: 1, unitPrice: 120, totalPrice: 120 },
                    ],
                  },
                },
              ],
            },
          },
          {
            name: 'Ensuite',
            sortOrder: 4,
            pieces: {
              create: [
                {
                  description: 'Double Vanity Top',
                  lengthMm: 2800,
                  widthMm: 520,
                  thicknessMm: 20,
                  areaSqm: 1.46,
                  materialId: 1,
                  materialName: 'Alpha Zero',
                  materialCost: 657.00,
                  featuresCost: 190.00,
                  totalCost: 847.00,
                  sortOrder: 1,
                  features: {
                    create: [
                      { name: 'Basin Cutout', quantity: 2, unitPrice: 95, totalPrice: 190 },
                    ],
                  },
                },
              ],
            },
          },
          {
            name: 'Bathroom',
            sortOrder: 5,
            pieces: {
              create: [
                {
                  description: 'Vanity Top',
                  lengthMm: 900,
                  widthMm: 520,
                  thicknessMm: 20,
                  areaSqm: 0.47,
                  materialId: 1,
                  materialName: 'Alpha Zero',
                  materialCost: 211.50,
                  featuresCost: 95.00,
                  totalCost: 306.50,
                  sortOrder: 1,
                  features: {
                    create: [
                      { name: 'Basin Cutout', quantity: 1, unitPrice: 95, totalPrice: 95 },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });
  console.log('✅ Created demo quote:', quote.quoteNumber);

  // ============================================
  // CREATE SETTINGS
  // ============================================
  const settings = [
    { key: 'quote_prefix', value: 'Q-' },
    { key: 'quote_validity_days', value: '30' },
    { key: 'deposit_percentage', value: '50' },
    { key: 'default_tax_rate', value: '10' },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: setting,
      create: setting,
    });
  }
  console.log('✅ Created settings');

  console.log('');
  console.log('🎉 Seeding complete!');
  console.log('');
  console.log('Demo login:');
  console.log('  Email: admin@northcoaststone.com.au');
  console.log('  Password: demo1234');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
