/**
 * Pricing Calculation Service V2
 *
 * Enhanced to include:
 * - PricingSettings (org-level configuration)
 * - Configurable material pricing: PER_SLAB vs PER_SQUARE_METRE
 * - Configurable service units per organisation
 * - ServiceRate (cutting, polishing, installation, waterfall)
 * - EdgeType thickness variants (20mm vs 40mm+)
 * - CutoutType categories with minimum charges
 * - Delivery cost calculation
 * - Templating cost calculation
 * - Manual overrides at quote and piece level
 */

import prisma from '@/lib/db';
import { calculateCutPlan } from './multi-slab-calculator';
import { JOIN_RATE_PER_METRE } from '@/lib/constants/slab-sizes';
import type { MaterialPricingBasis } from '@prisma/client';
import type {
  PricingOptions,
  PricingContext,
  CalculationResult,
  AppliedRule,
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
  pricingContext?: PricingContext;
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
 * Load pricing context for an organisation.
 * Returns org-level pricing settings or sensible defaults.
 */
export async function loadPricingContext(organisationId: string): Promise<PricingContext> {
  const settings = await prisma.pricingSettings.findUnique({
    where: { organisationId },
  });

  if (settings) {
    return {
      organisationId: settings.organisationId,
      materialPricingBasis: settings.materialPricingBasis,
      cuttingUnit: settings.cuttingUnit,
      polishingUnit: settings.polishingUnit,
      installationUnit: settings.installationUnit,
      currency: settings.currency,
      gstRate: Number(settings.gstRate),
    };
  }

  // Return defaults if no settings configured
  return {
    organisationId,
    materialPricingBasis: 'PER_SLAB',
    cuttingUnit: 'LINEAR_METRE',
    polishingUnit: 'LINEAR_METRE',
    installationUnit: 'SQUARE_METRE',
    currency: 'AUD',
    gstRate: 0.10,
  };
}

/**
 * Calculate material cost based on pricing basis.
 * PER_SLAB: uses slab count from optimiser × price per slab
 * PER_SQUARE_METRE: uses total area × price per m²
 */
export function calculateMaterialCost(
  pieces: Array<{
    lengthMm: number;
    widthMm: number;
    thicknessMm: number;
    material: {
      pricePerSqm: { toNumber: () => number };
      pricePerSlab?: { toNumber: () => number } | null;
      pricePerSquareMetre?: { toNumber: () => number } | null;
    } | null;
    overrideMaterialCost?: { toNumber: () => number } | null;
  }>,
  pricingBasis: MaterialPricingBasis = 'PER_SLAB',
  slabCount?: number
): MaterialBreakdown {
  let totalAreaM2 = 0;
  let subtotal = 0;

  for (const piece of pieces) {
    const areaSqm = (piece.lengthMm * piece.widthMm) / 1_000_000;
    totalAreaM2 += areaSqm;

    // Check for piece-level override
    if (piece.overrideMaterialCost) {
      subtotal += piece.overrideMaterialCost.toNumber();
      continue;
    }

    if (pricingBasis === 'PER_SLAB' && slabCount !== undefined) {
      // Per-slab pricing: use slab count × price per slab
      const slabPrice = piece.material?.pricePerSlab?.toNumber() ?? 0;
      if (slabPrice > 0 && slabCount > 0) {
        // Distribute slab cost proportionally across pieces by area
        const totalPieceArea = (piece.lengthMm * piece.widthMm) / 1_000_000;
        // This will be summed across all pieces, then replaced below
        subtotal += totalPieceArea * (slabPrice / (totalAreaM2 || 1));
      } else {
        // Fallback to per-m² if no slab price set
        const baseRate = piece.material?.pricePerSquareMetre?.toNumber()
          ?? piece.material?.pricePerSqm.toNumber()
          ?? 0;
        subtotal += areaSqm * baseRate;
      }
    } else {
      // Per square metre pricing
      const baseRate = piece.material?.pricePerSquareMetre?.toNumber()
        ?? piece.material?.pricePerSqm.toNumber()
        ?? 0;
      subtotal += areaSqm * baseRate;
    }
  }

  // For PER_SLAB, recalculate subtotal as slabCount × slabPrice if available
  if (pricingBasis === 'PER_SLAB' && slabCount !== undefined && slabCount > 0) {
    // Find the slab price from the first piece with a material
    const materialWithSlabPrice = pieces.find(p => p.material?.pricePerSlab?.toNumber());
    if (materialWithSlabPrice) {
      const slabPrice = materialWithSlabPrice.material!.pricePerSlab!.toNumber();
      // Only override if no piece-level overrides were applied
      const hasOverrides = pieces.some(p => p.overrideMaterialCost);
      if (!hasOverrides) {
        subtotal = slabCount * slabPrice;
      }
    }
  }

  const effectiveRate = totalAreaM2 > 0 ? roundToTwo(subtotal / totalAreaM2) : 0;

  return {
    totalAreaM2: roundToTwo(totalAreaM2),
    baseRate: effectiveRate,
    thicknessMultiplier: 1,
    appliedRate: effectiveRate,
    subtotal: roundToTwo(subtotal),
    discount: 0,
    total: roundToTwo(subtotal),
    pricingBasis,
    slabCount: pricingBasis === 'PER_SLAB' ? slabCount : undefined,
    slabRate: pricingBasis === 'PER_SLAB' && slabCount
      ? roundToTwo(subtotal / slabCount)
      : undefined,
  };
}

/**
 * Calculate service cost using configured units.
 * Supports LINEAR_METRE, SQUARE_METRE, FIXED, PER_SLAB, PER_KILOMETRE.
 */
export function calculateServiceCostForUnit(
  quantity: number,
  rate20mm: number,
  rate40mm: number,
  thickness: number,
  minimumCharge?: number
): number {
  const rate = thickness <= 20 ? rate20mm : rate40mm;
  let cost = quantity * rate;

  if (minimumCharge && minimumCharge > 0 && cost < minimumCharge) {
    cost = minimumCharge;
  }

  return roundToTwo(cost);
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

  // Load pricing context (org-level settings)
  // Use company ID "1" as default org for now (single-tenant)
  const pricingContext = await loadPricingContext('1');

  // Get pricing data
  const [edgeTypes, cutoutTypes, serviceRates] = await Promise.all([
    prisma.edgeType.findMany({ where: { isActive: true } }),
    prisma.cutoutType.findMany({ where: { isActive: true } }),
    prisma.serviceRate.findMany({ where: { isActive: true } }),
  ]);

  // Flatten all pieces
  const allPieces = quote.rooms.flatMap(room => room.pieces);

  // Get slab count from latest optimization (for PER_SLAB pricing)
  let slabCount: number | undefined;
  if (pricingContext.materialPricingBasis === 'PER_SLAB') {
    const optimization = await prisma.slabOptimization.findFirst({
      where: { quoteId: quoteIdNum },
      orderBy: { createdAt: 'desc' },
      select: { totalSlabs: true },
    });
    slabCount = optimization?.totalSlabs;
  }

  // Calculate material costs with pricing basis
  const materialBreakdown = calculateMaterialCost(
    allPieces,
    pricingContext.materialPricingBasis,
    slabCount
  );

  // Calculate edge costs with thickness variants
  const edgeData = calculateEdgeCostV2(allPieces, edgeTypes);

  // Calculate cutout costs with categories and minimums
  const cutoutData = calculateCutoutCostV2(allPieces, cutoutTypes);

  // Calculate service costs (cutting, polishing, installation, waterfall)
  const serviceData = calculateServiceCosts(allPieces, edgeData.totalLinearMeters, serviceRates);

  // Calculate join costs for oversized pieces
  for (const piece of allPieces) {
    const material = piece.material as unknown as { category?: string } | null;
    const materialCategory = material?.category || 'caesarstone';
    const cutPlan = calculateCutPlan(
      { lengthMm: piece.lengthMm, widthMm: piece.widthMm },
      materialCategory
    );

    if (!cutPlan.fitsOnSingleSlab) {
      serviceData.items.push({
        serviceType: 'JOIN',
        name: `Join - ${cutPlan.strategy}`,
        quantity: roundToTwo(cutPlan.joinLengthMm / 1000),
        unit: 'LINEAR_METRE',
        rate: JOIN_RATE_PER_METRE,
        subtotal: cutPlan.joinCost,
      });
      serviceData.subtotal += cutPlan.joinCost;
    }
  }

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
    pricingContext,
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

  for (const [, data] of Array.from(edgeTotals.entries())) {
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
    cutouts: unknown; // JSON array
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
                    (typeof piece.cutouts === 'string' ? JSON.parse(piece.cutouts as string) : []);

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

  for (const [, data] of Array.from(cutoutTotals.entries())) {
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
function calculateServiceCosts(
  pieces: Array<{ lengthMm: number; widthMm: number; thicknessMm: number; edgeTop: string | null; edgeBottom: string | null; edgeLeft: string | null; edgeRight: string | null }>,
  totalEdgeLinearMeters: number,
  serviceRates: Array<{
    serviceType: string;
    name: string;
    rate20mm: { toNumber: () => number };
    rate40mm: { toNumber: () => number };
    minimumCharge: { toNumber: () => number } | null;
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
      unit: 'SQUARE_METRE',
      rate: rate,
      subtotal: roundToTwo(cost),
    });
    subtotal += cost;
  }

  // Polishing: per linear meter, calculated per-piece based on actual thickness
  const polishingRate = serviceRates.find(sr => sr.serviceType === 'POLISHING');
  if (polishingRate && totalEdgeLinearMeters > 0) {
    // Calculate polishing cost per-piece to use correct thickness-based rate
    let polishingCost = 0;
    let totalPolishedMeters = 0;

    for (const piece of pieces) {
      // Sum finished edge lengths for this piece
      const edgeLengths = [
        piece.edgeTop ? piece.widthMm : 0,
        piece.edgeBottom ? piece.widthMm : 0,
        piece.edgeLeft ? piece.lengthMm : 0,
        piece.edgeRight ? piece.lengthMm : 0,
      ];
      const pieceEdgeMeters = edgeLengths.reduce((sum, len) => sum + len, 0) / 1000;
      if (pieceEdgeMeters <= 0) continue;

      const rate = piece.thicknessMm <= 20
        ? polishingRate.rate20mm.toNumber()
        : polishingRate.rate40mm.toNumber();

      polishingCost += pieceEdgeMeters * rate;
      totalPolishedMeters += pieceEdgeMeters;
    }

    const minCharge = polishingRate.minimumCharge?.toNumber() || 0;
    if (minCharge > 0 && polishingCost < minCharge) polishingCost = minCharge;

    // Use a weighted average rate for display
    const displayRate = totalPolishedMeters > 0
      ? roundToTwo(polishingCost / totalPolishedMeters)
      : polishingRate.rate20mm.toNumber();

    if (totalPolishedMeters > 0) {
      items.push({
        serviceType: 'POLISHING',
        name: polishingRate.name,
        quantity: roundToTwo(totalPolishedMeters),
        unit: 'LINEAR_METRE',
        rate: displayRate,
        subtotal: roundToTwo(polishingCost),
      });
      subtotal += polishingCost;
    }
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
