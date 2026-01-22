import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

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
  // CREATE MATERIALS - Alpha Zero Collection
  // ============================================
  const materials = [
    // Alpha Zero Collection (as per prompt)
    {
      name: 'Arctic',
      collection: 'Alpha Zero',
      supplier: 'Caesarstone',
      color: 'White/Grey',
      pricePerSqm: 450,
      slabLength: 3200,
      slabWidth: 1600,
      slabThickness: 20,
      finishType: 'Polished',
    },
    {
      name: 'Bondi',
      collection: 'Alpha Zero',
      supplier: 'Caesarstone',
      color: 'Blue/Grey',
      pricePerSqm: 480,
      slabLength: 3200,
      slabWidth: 1600,
      slabThickness: 20,
      finishType: 'Polished',
    },
    {
      name: 'Jewel',
      collection: 'Alpha Zero',
      supplier: 'Caesarstone',
      color: 'White/Gold',
      pricePerSqm: 520,
      slabLength: 3200,
      slabWidth: 1600,
      slabThickness: 20,
      finishType: 'Polished',
    },
    // Additional materials for variety
    {
      name: 'Calacatta Nuvo',
      collection: 'Premium Collection',
      supplier: 'Caesarstone',
      color: 'White/Grey Veins',
      pricePerSqm: 650,
      slabLength: 3200,
      slabWidth: 1600,
      slabThickness: 20,
      finishType: 'Polished',
    },
    {
      name: 'Statuario Maximus',
      collection: 'Premium Collection',
      supplier: 'Caesarstone',
      color: 'White/Bold Grey Veins',
      pricePerSqm: 720,
      slabLength: 3200,
      slabWidth: 1600,
      slabThickness: 20,
      finishType: 'Polished',
    },
    {
      name: 'Pure White',
      collection: 'Classic Collection',
      supplier: 'Caesarstone',
      color: 'Pure White',
      pricePerSqm: 380,
      slabLength: 3200,
      slabWidth: 1600,
      slabThickness: 20,
      finishType: 'Polished',
    },
    {
      name: 'Jet Black',
      collection: 'Classic Collection',
      supplier: 'Caesarstone',
      color: 'Black',
      pricePerSqm: 420,
      slabLength: 3200,
      slabWidth: 1600,
      slabThickness: 20,
      finishType: 'Polished',
    },
    {
      name: 'Empira White',
      collection: 'Designer Collection',
      supplier: 'Caesarstone',
      color: 'White/Subtle Grey',
      pricePerSqm: 550,
      slabLength: 3200,
      slabWidth: 1600,
      slabThickness: 20,
      finishType: 'Polished',
    },
    {
      name: 'Turbine Grey',
      collection: 'Industrial Collection',
      supplier: 'Caesarstone',
      color: 'Grey',
      pricePerSqm: 480,
      slabLength: 3200,
      slabWidth: 1600,
      slabThickness: 20,
      finishType: 'Honed',
    },
    {
      name: 'Concrete',
      collection: 'Industrial Collection',
      supplier: 'Caesarstone',
      color: 'Concrete Grey',
      pricePerSqm: 420,
      slabLength: 3200,
      slabWidth: 1600,
      slabThickness: 20,
      finishType: 'Honed',
    },
  ];

  // Delete existing materials and recreate
  await prisma.material.deleteMany({});
  for (const mat of materials) {
    await prisma.material.create({ data: mat });
  }
  console.log('✅ Created', materials.length, 'materials');

  // ============================================
  // CREATE PRICING RULES (as per Prompt 1)
  // ============================================
  const pricingRules = [
    // Edge Polish (per linear meter)
    {
      category: 'edge_polish',
      name: 'Pencil Round',
      price: 45,
      priceType: 'per_linear_meter',
      description: 'Standard pencil round edge polish',
      conditions: {},
    },
    {
      category: 'edge_polish',
      name: 'Bullnose',
      price: 55,
      priceType: 'per_linear_meter',
      description: 'Full bullnose edge polish',
      conditions: {},
    },
    {
      category: 'edge_polish',
      name: 'Arris',
      price: 35,
      priceType: 'per_linear_meter',
      description: 'Arris (eased) edge polish',
      conditions: {},
    },
    {
      category: 'edge_polish',
      name: 'Bevel',
      price: 40,
      priceType: 'per_linear_meter',
      description: '45 degree bevel edge polish',
      conditions: {},
    },
    {
      category: 'edge_polish',
      name: 'Ogee',
      price: 65,
      priceType: 'per_linear_meter',
      description: 'Decorative ogee profile edge',
      conditions: {},
    },
    {
      category: 'edge_polish',
      name: 'Mitered',
      price: 85,
      priceType: 'per_linear_meter',
      description: 'Mitered edge for thick appearance',
      conditions: {},
    },

    // Cutouts (per unit)
    {
      category: 'cutout',
      name: 'Undermount Sink (Standard)',
      price: 220,
      priceType: 'per_unit',
      description: 'Standard undermount sink cutout up to 750mm',
      conditions: { maxWidth: 750 },
    },
    {
      category: 'cutout',
      name: 'Undermount Sink (Large)',
      price: 280,
      priceType: 'per_unit',
      description: 'Large undermount sink cutout over 750mm',
      conditions: { minWidth: 751 },
    },
    {
      category: 'cutout',
      name: 'Hotplate (Standard)',
      price: 180,
      priceType: 'per_unit',
      description: 'Standard cooktop/hotplate cutout',
      conditions: { flushMount: false },
    },
    {
      category: 'cutout',
      name: 'Hotplate (Flush Mount)',
      price: 250,
      priceType: 'per_unit',
      description: 'Flush mount cooktop cutout with rebate',
      conditions: { flushMount: true },
    },
    {
      category: 'cutout',
      name: 'Tap Hole',
      price: 45,
      priceType: 'per_unit',
      description: 'Single tap hole (35mm diameter)',
      conditions: {},
    },
    {
      category: 'cutout',
      name: 'GPO Cutout',
      price: 65,
      priceType: 'per_unit',
      description: 'Powerpoint/GPO cutout',
      conditions: {},
    },
    {
      category: 'cutout',
      name: 'Basin Cutout',
      price: 95,
      priceType: 'per_unit',
      description: 'Bathroom basin cutout',
      conditions: {},
    },
    {
      category: 'cutout',
      name: 'Overmount Sink',
      price: 120,
      priceType: 'per_unit',
      description: 'Drop-in/overmount sink cutout',
      conditions: {},
    },

    // Thickness Multipliers
    {
      category: 'thickness_multiplier',
      name: '20mm Standard',
      price: 1.0,
      priceType: 'multiplier',
      description: 'Standard 20mm thickness (no multiplier)',
      conditions: { thickness: 20 },
    },
    {
      category: 'thickness_multiplier',
      name: '30mm Thickness',
      price: 1.15,
      priceType: 'multiplier',
      description: '30mm laminated thickness',
      conditions: { thickness: 30 },
    },
    {
      category: 'thickness_multiplier',
      name: '40mm Thickness',
      price: 1.3,
      priceType: 'multiplier',
      description: '40mm laminated thickness (mitered edge)',
      conditions: { thickness: 40 },
    },

    // Features
    {
      category: 'feature',
      name: 'Waterfall End',
      price: 350,
      priceType: 'per_unit',
      description: 'Waterfall return on island/bench end',
      conditions: {},
    },
    {
      category: 'feature',
      name: 'Corner Join',
      price: 120,
      priceType: 'per_unit',
      description: 'L-shaped corner join',
      conditions: {},
    },
    {
      category: 'feature',
      name: 'Radius Corner',
      price: 65,
      priceType: 'per_unit',
      description: 'Rounded corner',
      conditions: {},
    },
    {
      category: 'feature',
      name: 'Undermount Sink Polish',
      price: 85,
      priceType: 'per_unit',
      description: 'Polish undermount sink cutout edges',
      conditions: {},
    },
  ];

  // Delete existing pricing rules and recreate
  await prisma.pricingRule.deleteMany({});
  for (const rule of pricingRules) {
    await prisma.pricingRule.create({ data: rule });
  }
  console.log('✅ Created', pricingRules.length, 'pricing rules');

  // ============================================
  // CREATE DEMO CUSTOMERS
  // ============================================
  const customers = [
    {
      name: 'Dylan Slater',
      company: 'Dwyer Quality Homes',
      email: 'dylan@dwyerqh.com.au',
      phone: '0401 659 241',
      address: 'Lot 2782 (No. 36) Harvest Drive, Palmview QLD 4553',
    },
    {
      name: 'Gem Life',
      company: 'GemLife Highfields Heights',
      email: 'projects@gemlife.com.au',
      phone: '07 5555 1234',
      address: 'Highfields Heights, QLD',
    },
    {
      name: 'Sarah Johnson',
      company: null,
      email: 'sarah.j@email.com',
      phone: '0423 456 789',
      address: '45 Ocean View Dr, Sunshine Coast QLD 4556',
    },
  ];

  // Delete existing customers and recreate
  await prisma.customer.deleteMany({});
  for (const cust of customers) {
    await prisma.customer.create({ data: cust });
  }
  console.log('✅ Created', customers.length, 'customers');

  // ============================================
  // CREATE DEMO QUOTES (with different statuses)
  // ============================================

  // Delete existing quotes first
  await prisma.quote.deleteMany({});

  // Quote 1: Draft - Kitchen renovation with Alpha Zero Jewel
  const quote1 = await prisma.quote.create({
    data: {
      quoteNumber: 'Q-20260122-001',
      customerId: 1,
      projectName: 'Slater Kitchen Renovation',
      projectAddress: 'Lot 2782 (No. 36) Harvest Drive, Palmview QLD 4553',
      status: 'draft',
      subtotal: 4570.0,
      taxRate: 10,
      taxAmount: 457.0,
      total: 5027.0,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notes:
        'This Quote is based on the proviso that all stonework is the same colour and fabricated and installed at the same time.',
      createdBy: 1,
      rooms: {
        create: [
          {
            name: 'Kitchen',
            sortOrder: 1,
            pieces: {
              create: [
                {
                  description: 'Island Bench Top',
                  lengthMm: 3600,
                  widthMm: 900,
                  thicknessMm: 20,
                  areaSqm: 3.24,
                  materialId: 3, // Jewel
                  materialName: 'Alpha Zero / Jewel',
                  edges: {
                    top: { type: 'polish', profile: 'arris', meters: 3.6, cost: 126 },
                    right: { type: 'waterfall', meters: 0.9, cost: 0 },
                    bottom: { type: 'polish', profile: 'arris', meters: 3.6, cost: 126 },
                    left: { type: 'waterfall', meters: 0.9, cost: 0 },
                  },
                  cutouts: [
                    {
                      id: 'cut1',
                      type: 'undermount_sink',
                      make: 'Oliveri',
                      model: 'SN1063U',
                      width: 800,
                      length: 450,
                      cost: 220,
                      onSite: false,
                      inFactory: false,
                    },
                    {
                      id: 'cut2',
                      type: 'hotplate',
                      make: 'Euro',
                      model: 'ECT90ICB2',
                      width: 900,
                      length: 520,
                      cost: 180,
                      onSite: false,
                      inFactory: false,
                    },
                  ],
                  materialCost: 1684.8,
                  edgeCost: 252.0,
                  cutoutsCost: 400.0,
                  featuresCost: 0,
                  totalCost: 2336.8,
                  sortOrder: 1,
                },
                {
                  description: 'Benchtop Run',
                  lengthMm: 2400,
                  widthMm: 600,
                  thicknessMm: 20,
                  areaSqm: 1.44,
                  materialId: 3, // Jewel
                  materialName: 'Alpha Zero / Jewel',
                  edges: {
                    top: {
                      type: 'polish',
                      profile: 'pencil_round',
                      meters: 2.4,
                      cost: 108,
                    },
                    right: { type: 'raw', meters: 0.6, cost: 0 },
                    bottom: { type: 'raw', meters: 2.4, cost: 0 },
                    left: { type: 'raw', meters: 0.6, cost: 0 },
                  },
                  cutouts: [],
                  materialCost: 748.8,
                  edgeCost: 108.0,
                  cutoutsCost: 0,
                  featuresCost: 0,
                  totalCost: 856.8,
                  sortOrder: 2,
                },
                {
                  description: 'Splashback',
                  lengthMm: 2400,
                  widthMm: 600,
                  thicknessMm: 20,
                  areaSqm: 1.44,
                  materialId: 3, // Jewel
                  materialName: 'Alpha Zero / Jewel',
                  edges: {
                    top: { type: 'raw', meters: 2.4, cost: 0 },
                    right: { type: 'raw', meters: 0.6, cost: 0 },
                    bottom: { type: 'raw', meters: 2.4, cost: 0 },
                    left: { type: 'raw', meters: 0.6, cost: 0 },
                  },
                  cutouts: [],
                  materialCost: 748.8,
                  edgeCost: 0,
                  cutoutsCost: 0,
                  featuresCost: 0,
                  totalCost: 748.8,
                  sortOrder: 3,
                },
              ],
            },
          },
          {
            name: 'Bathroom',
            sortOrder: 2,
            pieces: {
              create: [
                {
                  description: 'Vanity Top',
                  lengthMm: 1200,
                  widthMm: 520,
                  thicknessMm: 20,
                  areaSqm: 0.624,
                  materialId: 1, // Arctic
                  materialName: 'Alpha Zero / Arctic',
                  edges: {
                    top: {
                      type: 'polish',
                      profile: 'bullnose',
                      meters: 1.2,
                      cost: 66,
                    },
                    right: { type: 'polish', profile: 'bullnose', meters: 0.52, cost: 28.6 },
                    bottom: { type: 'raw', meters: 1.2, cost: 0 },
                    left: { type: 'polish', profile: 'bullnose', meters: 0.52, cost: 28.6 },
                  },
                  cutouts: [
                    {
                      id: 'cut1',
                      type: 'undermount_sink',
                      make: 'Oliveri',
                      model: 'Basin',
                      width: 400,
                      length: 350,
                      cost: 220,
                      onSite: false,
                      inFactory: false,
                    },
                  ],
                  materialCost: 280.8,
                  edgeCost: 123.2,
                  cutoutsCost: 220.0,
                  featuresCost: 0,
                  totalCost: 624.0,
                  sortOrder: 1,
                },
              ],
            },
          },
        ],
      },
    },
  });
  console.log('✅ Created draft quote:', quote1.quoteNumber);

  // Quote 2: Sent - GemLife project
  const quote2 = await prisma.quote.create({
    data: {
      quoteNumber: 'Q-20260118-001',
      customerId: 2,
      projectName: 'Moreton Bay Stage 2 - Villa 48',
      projectAddress: 'Villa 48, Highfields Heights, QLD',
      status: 'sent',
      subtotal: 6818.0,
      taxRate: 10,
      taxAmount: 681.8,
      total: 7499.8,
      validUntil: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      notes:
        'This Quote is based on the proviso that all stonework is the same colour and fabricated and installed at the same time.',
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
                  materialId: 1, // Arctic
                  materialName: 'Alpha Zero / Arctic',
                  edges: {
                    top: {
                      type: 'polish',
                      profile: 'pencil_round',
                      meters: 2.7,
                      cost: 121.5,
                    },
                    right: { type: 'waterfall', meters: 0.9, cost: 0 },
                    bottom: {
                      type: 'polish',
                      profile: 'pencil_round',
                      meters: 2.7,
                      cost: 121.5,
                    },
                    left: { type: 'waterfall', meters: 0.9, cost: 0 },
                  },
                  cutouts: [
                    {
                      id: 'cut1',
                      type: 'undermount_sink',
                      make: 'Franke',
                      model: 'Kubus KBX110-70',
                      width: 720,
                      length: 430,
                      cost: 220,
                      onSite: true,
                      inFactory: false,
                    },
                  ],
                  materialCost: 1421.55, // With 1.3x multiplier
                  edgeCost: 243.0,
                  cutoutsCost: 220.0,
                  featuresCost: 700.0, // 2x waterfall ends
                  totalCost: 2584.55,
                  sortOrder: 1,
                },
                {
                  description: 'Back Bench',
                  lengthMm: 1990,
                  widthMm: 650,
                  thicknessMm: 40,
                  areaSqm: 1.29,
                  materialId: 1, // Arctic
                  materialName: 'Alpha Zero / Arctic',
                  edges: {
                    top: {
                      type: 'polish',
                      profile: 'pencil_round',
                      meters: 1.99,
                      cost: 89.55,
                    },
                    right: { type: 'raw', meters: 0.65, cost: 0 },
                    bottom: { type: 'raw', meters: 1.99, cost: 0 },
                    left: { type: 'raw', meters: 0.65, cost: 0 },
                  },
                  cutouts: [
                    {
                      id: 'cut1',
                      type: 'hotplate',
                      make: 'Bosch',
                      model: 'PXE675DC1E',
                      width: 600,
                      length: 520,
                      cost: 180,
                      onSite: false,
                      inFactory: false,
                    },
                  ],
                  materialCost: 754.65, // With 1.3x multiplier
                  edgeCost: 89.55,
                  cutoutsCost: 180.0,
                  featuresCost: 0,
                  totalCost: 1024.2,
                  sortOrder: 2,
                },
              ],
            },
          },
          {
            name: 'Ensuite',
            sortOrder: 2,
            pieces: {
              create: [
                {
                  description: 'Double Vanity Top',
                  lengthMm: 2800,
                  widthMm: 520,
                  thicknessMm: 20,
                  areaSqm: 1.456,
                  materialId: 1, // Arctic
                  materialName: 'Alpha Zero / Arctic',
                  edges: {
                    top: {
                      type: 'polish',
                      profile: 'pencil_round',
                      meters: 2.8,
                      cost: 126,
                    },
                    right: {
                      type: 'polish',
                      profile: 'pencil_round',
                      meters: 0.52,
                      cost: 23.4,
                    },
                    bottom: { type: 'raw', meters: 2.8, cost: 0 },
                    left: {
                      type: 'polish',
                      profile: 'pencil_round',
                      meters: 0.52,
                      cost: 23.4,
                    },
                  },
                  cutouts: [
                    {
                      id: 'cut1',
                      type: 'undermount_sink',
                      make: '',
                      model: '',
                      width: 400,
                      length: 350,
                      cost: 220,
                      onSite: false,
                      inFactory: false,
                    },
                    {
                      id: 'cut2',
                      type: 'undermount_sink',
                      make: '',
                      model: '',
                      width: 400,
                      length: 350,
                      cost: 220,
                      onSite: false,
                      inFactory: false,
                    },
                  ],
                  materialCost: 655.2,
                  edgeCost: 172.8,
                  cutoutsCost: 440.0,
                  featuresCost: 0,
                  totalCost: 1268.0,
                  sortOrder: 1,
                },
              ],
            },
          },
        ],
      },
    },
  });
  console.log('✅ Created sent quote:', quote2.quoteNumber);

  // Quote 3: Accepted - Sarah's bathroom
  const quote3 = await prisma.quote.create({
    data: {
      quoteNumber: 'Q-20260110-001',
      customerId: 3,
      projectName: 'Johnson Bathroom Renovation',
      projectAddress: '45 Ocean View Dr, Sunshine Coast QLD 4556',
      status: 'accepted',
      subtotal: 1850.0,
      taxRate: 10,
      taxAmount: 185.0,
      total: 2035.0,
      validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      notes: 'Customer to supply sink and tapware.',
      createdBy: 1,
      rooms: {
        create: [
          {
            name: 'Bathroom',
            sortOrder: 1,
            pieces: {
              create: [
                {
                  description: 'Main Vanity',
                  lengthMm: 1800,
                  widthMm: 600,
                  thicknessMm: 20,
                  areaSqm: 1.08,
                  materialId: 4, // Calacatta Nuvo
                  materialName: 'Calacatta Nuvo',
                  edges: {
                    top: { type: 'polish', profile: 'bullnose', meters: 1.8, cost: 99 },
                    right: { type: 'polish', profile: 'bullnose', meters: 0.6, cost: 33 },
                    bottom: { type: 'raw', meters: 1.8, cost: 0 },
                    left: { type: 'polish', profile: 'bullnose', meters: 0.6, cost: 33 },
                  },
                  cutouts: [
                    {
                      id: 'cut1',
                      type: 'undermount_sink',
                      make: 'Customer Supply',
                      model: '',
                      width: 500,
                      length: 400,
                      cost: 220,
                      onSite: true,
                      inFactory: false,
                    },
                    {
                      id: 'cut2',
                      type: 'tap_hole',
                      diameter: 35,
                      cost: 45,
                      onSite: false,
                      inFactory: true,
                    },
                  ],
                  materialCost: 702.0,
                  edgeCost: 165.0,
                  cutoutsCost: 265.0,
                  featuresCost: 0,
                  totalCost: 1132.0,
                  sortOrder: 1,
                },
                {
                  description: 'Splashback',
                  lengthMm: 1800,
                  widthMm: 200,
                  thicknessMm: 20,
                  areaSqm: 0.36,
                  materialId: 4, // Calacatta Nuvo
                  materialName: 'Calacatta Nuvo',
                  edges: {
                    top: { type: 'polish', profile: 'pencil_round', meters: 1.8, cost: 81 },
                    right: { type: 'raw', meters: 0.2, cost: 0 },
                    bottom: { type: 'raw', meters: 1.8, cost: 0 },
                    left: { type: 'raw', meters: 0.2, cost: 0 },
                  },
                  cutouts: [],
                  materialCost: 234.0,
                  edgeCost: 81.0,
                  cutoutsCost: 0,
                  featuresCost: 0,
                  totalCost: 315.0,
                  sortOrder: 2,
                },
              ],
            },
          },
        ],
      },
    },
  });
  console.log('✅ Created accepted quote:', quote3.quoteNumber);

  // ============================================
  // CREATE SETTINGS
  // ============================================
  const settings = [
    { key: 'quote_prefix', value: 'Q-' },
    { key: 'quote_validity_days', value: '30' },
    { key: 'deposit_percentage', value: '50' },
    { key: 'default_tax_rate', value: '10' },
    { key: 'company_name', value: 'Northcoast Stone Pty Ltd' },
    { key: 'company_address', value: '123 Stone Street, Maroochydore QLD 4558' },
    { key: 'company_phone', value: '07 5555 1234' },
    { key: 'company_email', value: 'quotes@northcoaststone.com.au' },
    { key: 'company_abn', value: '12 345 678 901' },
    { key: 'default_saw_kerf', value: '5' },
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
  console.log('');
  console.log('Sample quotes created:');
  console.log('  - Q-20260122-001 (Draft) - Kitchen renovation');
  console.log('  - Q-20260118-001 (Sent) - GemLife Villa 48');
  console.log('  - Q-20260110-001 (Accepted) - Bathroom renovation');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
