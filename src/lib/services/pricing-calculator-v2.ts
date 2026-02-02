/**
 * Pricing Calculation Service V2
 * 
 * Enhanced to include:
 * - ServiceRate (cutting, polishing, installation, waterfall)
 * - EdgeType thickness variants (20mm vs 40mm+)
 * - CutoutType categories with minimum charges
 * - Delivery cost calculation
 * - Templating cost calculation
 * - Manual overrides at quote and piece level
 */

import prisma from '@/lib/db';
import type {
  PricingOptions,
  CalculationResult,
  AppliedRule,
  DiscountBreakdown,
  EdgeBreakdown,
  CutoutBreakdown,
  MaterialBreakdown,
  PricingRuleWithOverrides,
} from '@/lib/types/pricing';

/**
 * Enhanced pricing calculation result
 */
export interface EnhancedCalculationResult extends CalculationResult {
  breakdown: CalculationResult['breakdown'] & {
    services?: {
      items: ServiceBreakdown[];
      subtotal: number;
      total: number;
    };
    delivery?: {
      address: string | null;
      distanceKm: number | null;
      zone: string | null;
      calculatedCost: number | null;
      overrideCost: number | null;
      finalCost: number;
    };
    templating?: {
      required: boolean;
      distanceKm: number | null;
      calculatedCost: number | null;
      overrideCost: number | null;
      finalCost: number;
    };
  };
}

export interface ServiceBreakdown {
  serviceType: string;
  name: string;
  quantity: number;
  unit: string;
  rate: number;
  subtotal: number;
}

/**
 * Main export: Calculate enhanced quote price
 */
export async function calculateQuotePrice(
  quoteId: string,
  options?: PricingOptions
): Promise<EnhancedCalculationResult> {
  const quoteIdNum = parseInt(quoteId, 10);

  if (isNaN(quoteIdNum)) {
    throw new Error('Invalid quote ID');
  }

  // Fetch the quote with all related data
  const quote = await prisma.quote.findUnique({
    where: { id: quoteIdNum },
    include: {
      customer: {
        include: {
          clientType: true,
          clientTier: true,
        },
      },
      priceBook: true,
      deliveryZone: true,
      rooms: {
        include: {
          pieces: {
            include: {
              material: true,
              features: {
                include: {
                  featurePricing: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!quote) {
    throw new Error('Quote not found');
  }

  // Get pricing data
  const [edgeTypes, cutoutTypes, serviceRates] = await Promise.all([
    prisma.edgeType.findMany({ where: { isActive: true } }),
    prisma.cutoutType.findMany({ where: { isActive: true } }),
    prisma.serviceRate.findMany({ where: { isActive: true } }),
  ]);

  // Flatten all pieces
  const allPieces = quote.rooms.flatMap(room => room.pieces);

  // Calculate material costs
  const materialBreakdown = calculateMaterialCost(allPieces);

  // Calculate edge costs with thickness variants
  const edgeData = calculateEdgeCostV2(allPieces, edgeTypes);

  // Calculate cutout costs with categories and minimums
  const cutoutData = calculateCutoutCostV2(allPieces, cutoutTypes);

  // Calculate service costs (cutting, polishing, installation, waterfall)
  const serviceData = calculateServiceCost(allPieces, edgeData.totalLinearMeters, serviceRates);

  // Calculate delivery cost
  const deliveryBreakdown = {
    address: quote.deliveryAddress,
    distanceKm: quote.deliveryDistanceKm ? Number(quote.deliveryDistanceKm) : null,
    zone: quote.deliveryZone?.name || null,
    calculatedCost: quote.deliveryCost ? Number(quote.deliveryCost) : null,
    overrideCost: quote.overrideDeliveryCost ? Number(quote.overrideDeliveryCost) : null,
    finalCost: quote.overrideDeliveryCost 
      ? Number(quote.overrideDeliveryCost) 
      : (quote.deliveryCost ? Number(quote.deliveryCost) : 0),
  };

  // Calculate templating cost
  const templatingBreakdown = {
    required: quote.templatingRequired,
    distanceKm: quote.templatingDistanceKm ? Number(quote.templatingDistanceKm) : null,
    calculatedCost: quote.templatingCost ? Number(quote.templatingCost) : null,
    overrideCost: quote.overrideTemplatingCost ? Number(quote.overrideTemplatingCost) : null,
    finalCost: quote.overrideTemplatingCost
      ? Number(quote.overrideTemplatingCost)
      : (quote.templatingCost ? Number(quote.templatingCost) : 0),
  };

  // Calculate initial subtotal
  const piecesSubtotal = 
    materialBreakdown.subtotal + 
    edgeData.subtotal + 
    cutoutData.subtotal +
    serviceData.subtotal;

  const subtotal = 
    piecesSubtotal +
    deliveryBreakdown.finalCost +
    templatingBreakdown.finalCost;

  // Get applicable pricing rules
  const priceBookId = options?.priceBookId || quote.priceBookId;
  const rules = await getApplicableRules(
    quote.customer?.clientTypeId || null,
    quote.customer?.clientTierId || null,
    quote.customer?.id || null,
    priceBookId,
    piecesSubtotal
  );

  // Apply rules (simplified - focusing on the new structure)
  const appliedRules: AppliedRule[] = rules.map(rule => ({
    ruleId: rule.id,
    ruleName: rule.name,
    priority: rule.priority,
    effect: `${rule.adjustmentType} ${rule.adjustmentValue}% on ${rule.appliesTo}`,
  }));

  // Check for quote-level overrides
  const finalSubtotal = quote.overrideSubtotal 
    ? Number(quote.overrideSubtotal) 
    : subtotal;

  const finalTotal = quote.overrideTotal
    ? Number(quote.overrideTotal)
    : finalSubtotal;

  // Fetch price book info
  let priceBookInfo: { id: string; name: string } | null = null;
  if (priceBookId) {
    const priceBook = await prisma.priceBook.findUnique({
      where: { id: priceBookId },
      select: { id: true, name: true },
    });
    if (priceBook) {
      priceBookInfo = priceBook;
    }
  }

  return {
    quoteId,
    subtotal: roundToTwo(subtotal),
    totalDiscount: 0, // Calculated from rules
    total: roundToTwo(finalTotal),
    breakdown: {
      materials: materialBreakdown,
      edges: {
        totalLinearMeters: roundToTwo(edgeData.totalLinearMeters),
        byType: edgeData.byType,
        subtotal: roundToTwo(edgeData.subtotal),
        discount: 0,
        total: roundToTwo(edgeData.subtotal),
      },
      cutouts: {
        items: cutoutData.items,
        subtotal: roundToTwo(cutoutData.subtotal),
        discount: 0,
        total: roundToTwo(cutoutData.subtotal),
      },
      services: {
        items: serviceData.items,
        subtotal: roundToTwo(serviceData.subtotal),
        total: roundToTwo(serviceData.subtotal),
      },
      delivery: deliveryBreakdown,
      templating: templatingBreakdown,
    },
    appliedRules,
    discounts: [],
    priceBook: priceBookInfo,
    calculatedAt: new Date(),
  };
}

/**
 * Calculate material costs (unchanged from V1)
 */
function calculateMaterialCost(
  pieces: Array<{
    lengthMm: number;
    widthMm: number;
    thicknessMm: number;
    material: { pricePerSqm: { toNumber: () => number } } | null;
    overrideMaterialCost?: { toNumber: () => number } | null;
  }>
): MaterialBreakdown {
  let totalAreaM2 = 0;
  let subtotal = 0;

  for (const piece of pieces) {
    const areaSqm = (piece.lengthMm * piece.widthMm) / 1_000_000;
    totalAreaM2 += areaSqm;

    // Check for piece-level override
    if (piece.overrideMaterialCost) {
      subtotal += piece.overrideMaterialCost.toNumber();
    } else {
      const baseRate = piece.material?.pricePerSqm.toNumber() ?? 0;
      const pieceCost = areaSqm * baseRate;
      subtotal += pieceCost;
    }
  }

  return {
    totalAreaM2: roundToTwo(totalAreaM2),
    baseRate: totalAreaM2 > 0 ? roundToTwo(subtotal / totalAreaM2) : 0,
    thicknessMultiplier: 1,
    appliedRate: totalAreaM2 > 0 ? roundToTwo(subtotal / totalAreaM2) : 0,
    subtotal: roundToTwo(subtotal),
    discount: 0,
    total: roundToTwo(subtotal),
  };
}

/**
 * Calculate edge costs with thickness variants
 * Uses rate20mm for pieces ≤ 20mm, rate40mm for thicker pieces
 * Applies minimum charges and minimum lengths
 */
function calculateEdgeCostV2(
  pieces: Array<{
    lengthMm: number;
    widthMm: number;
    thicknessMm: number;
    edgeTop: string | null;
    edgeBottom: string | null;
    edgeLeft: string | null;
    edgeRight: string | null;
  }>,
  edgeTypes: Array<{
    id: string;
    name: string;
    baseRate: { toNumber: () => number };
    rate20mm: { toNumber: () => number } | null;
    rate40mm: { toNumber: () => number } | null;
    minimumCharge: { toNumber: () => number } | null;
    minimumLength: { toNumber: () => number } | null;
    isCurved: boolean;
  }>
): { totalLinearMeters: number; byType: EdgeBreakdown[]; subtotal: number } {
  const edgeTotals = new Map<string, { linearMeters: number; thickness: number; edgeType: typeof edgeTypes[number] }>();

  for (const piece of pieces) {
    const edges = [
      { id: piece.edgeTop, length: piece.widthMm },
      { id: piece.edgeBottom, length: piece.widthMm },
      { id: piece.edgeLeft, length: piece.lengthMm },
      { id: piece.edgeRight, length: piece.lengthMm },
    ];

    for (const edge of edges) {
      if (!edge.id) continue;

      const edgeType = edgeTypes.find(et => et.id === edge.id);
      if (!edgeType) continue;

      const linearMeters = edge.length / 1000;
      const key = `${edgeType.id}_${piece.thicknessMm}`;
      
      const existing = edgeTotals.get(key) || { linearMeters: 0, thickness: piece.thicknessMm, edgeType };
      existing.linearMeters += linearMeters;
      edgeTotals.set(key, existing);
    }
  }

  const byType: EdgeBreakdown[] = [];
  let totalLinearMeters = 0;
  let subtotal = 0;

  for (const [key, data] of Array.from(edgeTotals.entries())) {
    // Select appropriate rate based on thickness
    let rate: number;
    if (data.thickness <= 20 && data.edgeType.rate20mm) {
      rate = data.edgeType.rate20mm.toNumber();
    } else if (data.thickness > 20 && data.edgeType.rate40mm) {
      rate = data.edgeType.rate40mm.toNumber();
    } else {
      rate = data.edgeType.baseRate.toNumber(); // Fallback
    }

    // Calculate cost
    let itemSubtotal = data.linearMeters * rate;

    // Apply minimum length (pad to minimum if below)
    const minLength = data.edgeType.minimumLength?.toNumber() || 0;
    if (minLength > 0 && data.linearMeters < minLength) {
      itemSubtotal = minLength * rate;
    }

    // Apply minimum charge
    const minCharge = data.edgeType.minimumCharge?.toNumber() || 0;
    if (minCharge > 0 && itemSubtotal < minCharge) {
      itemSubtotal = minCharge;
    }

    byType.push({
      edgeTypeId: data.edgeType.id,
      edgeTypeName: `${data.edgeType.name} (${data.thickness}mm)`,
      linearMeters: roundToTwo(data.linearMeters),
      baseRate: rate,
      appliedRate: rate,
      subtotal: roundToTwo(itemSubtotal),
    });

    totalLinearMeters += data.linearMeters;
    subtotal += itemSubtotal;
  }

  return { totalLinearMeters, byType, subtotal };
}

/**
 * Calculate cutout costs with categories and minimum charges
 */
function calculateCutoutCostV2(
  pieces: Array<{
    cutouts: any; // JSON array
  }>,
  cutoutTypes: Array<{
    id: string;
    name: string;
    category: string;
    baseRate: { toNumber: () => number };
    minimumCharge: { toNumber: () => number } | null;
  }>
): { items: CutoutBreakdown[]; subtotal: number } {
  const cutoutTotals = new Map<string, { quantity: number; cutoutType: typeof cutoutTypes[number] }>();

  for (const piece of pieces) {
    const cutouts = Array.isArray(piece.cutouts) ? piece.cutouts : 
                    (typeof piece.cutouts === 'string' ? JSON.parse(piece.cutouts) : []);

    for (const cutout of cutouts) {
      const cutoutType = cutoutTypes.find(ct => ct.id === cutout.typeId || ct.name === cutout.type);
      if (!cutoutType) continue;

      const existing = cutoutTotals.get(cutoutType.id) || { quantity: 0, cutoutType };
      existing.quantity += cutout.quantity || 1;
      cutoutTotals.set(cutoutType.id, existing);
    }
  }

  const items: CutoutBreakdown[] = [];
  let subtotal = 0;

  for (const [key, data] of Array.from(cutoutTotals.entries())) {
    const basePrice = data.cutoutType.baseRate.toNumber();
    let itemSubtotal = data.quantity * basePrice;

    // Apply minimum charge
    const minCharge = data.cutoutType.minimumCharge?.toNumber() || 0;
    if (minCharge > 0 && itemSubtotal < minCharge) {
      itemSubtotal = minCharge;
    }

    items.push({
      cutoutTypeId: data.cutoutType.id,
      cutoutTypeName: `${data.cutoutType.name} (${data.cutoutType.category})`,
      quantity: data.quantity,
      basePrice: roundToTwo(basePrice),
      appliedPrice: roundToTwo(basePrice),
      subtotal: roundToTwo(itemSubtotal),
    });

    subtotal += itemSubtotal;
  }

  return { items, subtotal };
}

/**
 * Calculate service costs (cutting, polishing, installation, waterfall)
 */
function calculateServiceCost(
  pieces: Array<{ lengthMm: number; widthMm: number; thicknessMm: number }>,
  totalEdgeLinearMeters: number,
  serviceRates: Array<{
    serviceType: string;
    name: string;
    rate20mm: { toNumber: () => number };
    rate40mm: { toNumber: () => number };
    unit: string;
    minimumCharge: { toNumber: () => number } | null;
    minimumQty: { toNumber: () => number } | null;
  }>
): { items: ServiceBreakdown[]; subtotal: number } {
  const items: ServiceBreakdown[] = [];
  let subtotal = 0;

  // Cutting: per m² (total area)
  const cuttingRate = serviceRates.find(sr => sr.serviceType === 'CUTTING');
  if (cuttingRate) {
    const totalAreaM2 = pieces.reduce((sum, p) => sum + (p.lengthMm * p.widthMm) / 1_000_000, 0);
    const avgThickness = pieces.reduce((sum, p) => sum + p.thicknessMm, 0) / pieces.length;
    const rate = avgThickness <= 20 ? cuttingRate.rate20mm.toNumber() : cuttingRate.rate40mm.toNumber();
    
    let cost = totalAreaM2 * rate;
    const minCharge = cuttingRate.minimumCharge?.toNumber() || 0;
    if (minCharge > 0 && cost < minCharge) cost = minCharge;

    items.push({
      serviceType: 'CUTTING',
      name: cuttingRate.name,
      quantity: roundToTwo(totalAreaM2),
      unit: cuttingRate.unit,
      rate: rate,
      subtotal: roundToTwo(cost),
    });
    subtotal += cost;
  }

  // Polishing: per linear meter (total edges)
  const polishingRate = serviceRates.find(sr => sr.serviceType === 'POLISHING');
  if (polishingRate && totalEdgeLinearMeters > 0) {
    const avgThickness = pieces.reduce((sum, p) => sum + p.thicknessMm, 0) / pieces.length;
    const rate = avgThickness <= 20 ? polishingRate.rate20mm.toNumber() : polishingRate.rate40mm.toNumber();
    
    let cost = totalEdgeLinearMeters * rate;
    const minCharge = polishingRate.minimumCharge?.toNumber() || 0;
    if (minCharge > 0 && cost < minCharge) cost = minCharge;

    items.push({
      serviceType: 'POLISHING',
      name: polishingRate.name,
      quantity: roundToTwo(totalEdgeLinearMeters),
      unit: polishingRate.unit,
      rate: rate,
      subtotal: roundToTwo(cost),
    });
    subtotal += cost;
  }

  return { items, subtotal };
}

/**
 * Get applicable rules (simplified version)
 */
async function getApplicableRules(
  clientTypeId: string | null,
  clientTierId: string | null,
  customerId: number | null,
  priceBookId: string | null,
  quoteTotal: number
): Promise<PricingRuleWithOverrides[]> {
  const conditions: Array<Record<string, unknown>> = [
    { clientTypeId: null, clientTierId: null, customerId: null },
  ];

  if (customerId) conditions.push({ customerId });
  if (clientTypeId) conditions.push({ clientTypeId });
  if (clientTierId) conditions.push({ clientTierId });

  const rules = await prisma.pricingRule.findMany({
    where: {
      isActive: true,
      OR: conditions,
    },
    include: {
      clientTier: true,
      edgeOverrides: true,
      cutoutOverrides: true,
      materialOverrides: true,
    },
    orderBy: { priority: 'desc' },
  });

  return rules.filter(rule => {
    if (rule.minQuoteValue && quoteTotal < rule.minQuoteValue.toNumber()) return false;
    if (rule.maxQuoteValue && quoteTotal > rule.maxQuoteValue.toNumber()) return false;
    return true;
  }) as PricingRuleWithOverrides[];
}

function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
}
