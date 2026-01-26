/**
 * Pricing Calculation Service
 *
 * Calculates quote prices by applying pricing rules based on:
 * - Customer's client type and tier
 * - Assigned price book
 * - Volume thresholds
 *
 * Testing Scenarios:
 *
 * Scenario 1: Retail customer (no discounts)
 * - 2 pieces: 3600×650mm each = 4.68m² total
 * - Pencil Round on front edges only: 3600mm × 2 pieces = 7.2lm
 * - 1 undermount sink cutout
 * - Expected:
 *   * Materials: 4.68m² × $140 = $655.20
 *   * Edges: 7.2lm × $35 = $252.00
 *   * Cutout: $220.00
 *   * Total: $1,127.20
 *
 * Scenario 2: Tier 1 Cabinet Maker
 * - Same pieces as above
 * - Rules applied: 15% material discount, $30/lm edge override
 * - Expected:
 *   * Materials: $655.20 - 15% = $556.92
 *   * Edges: 7.2lm × $30 = $216.00
 *   * Cutout: $220.00
 *   * Total: $992.92
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
  EdgeTypeWithRate,
  CutoutTypeWithRate,
} from '@/lib/types/pricing';

// Priority constants for rule ordering
const PRIORITY = {
  CUSTOMER_SPECIFIC: 100,
  CLIENT_TYPE: 50,
  VOLUME_BASED: 25,
  DEFAULT: 0,
};

/**
 * Main export: Calculate the full price for a quote
 */
export async function calculateQuotePrice(
  quoteId: string,
  options?: PricingOptions
): Promise<CalculationResult> {
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

  // Get all edge types and cutout types for pricing
  const [edgeTypes, cutoutTypes, thicknessOptions] = await Promise.all([
    prisma.edgeType.findMany({ where: { isActive: true } }),
    prisma.cutoutType.findMany({ where: { isActive: true } }),
    prisma.thicknessOption.findMany({ where: { isActive: true } }),
  ]);

  // Flatten all pieces from all rooms
  const allPieces = quote.rooms.flatMap((room: typeof quote.rooms[number]) => room.pieces);

  // Calculate initial material costs
  const materialBreakdown = calculateMaterialCost(allPieces, thicknessOptions);

  // Calculate edge costs (before rule application)
  const edgeData = calculateEdgeCost(allPieces, edgeTypes);

  // Calculate cutout costs (before rule application)
  const cutoutData = calculateCutoutCost(allPieces, cutoutTypes);

  // Calculate initial subtotal for rule matching
  const initialSubtotal = materialBreakdown.subtotal + edgeData.subtotal + cutoutData.subtotal;

  // Determine which price book to use
  const priceBookId = options?.priceBookId || quote.priceBookId;

  // Get applicable pricing rules
  const rules = await getApplicableRules(
    quote.customer?.clientTypeId || null,
    quote.customer?.clientTierId || null,
    quote.customer?.id || null,
    priceBookId,
    initialSubtotal
  );

  // Apply rules to get final pricing
  const {
    materialDiscount,
    edgeDiscount,
    cutoutDiscount,
    appliedRules,
    discounts,
    edgeRateOverrides,
    cutoutRateOverrides,
    materialRateOverrides,
  } = applyRules(
    materialBreakdown.subtotal,
    edgeData.subtotal,
    cutoutData.subtotal,
    rules
  );

  // Recalculate edges with rate overrides
  const finalEdgeData = calculateEdgeCostWithOverrides(
    allPieces,
    edgeTypes,
    edgeRateOverrides
  );

  // Recalculate cutouts with rate overrides
  const finalCutoutData = calculateCutoutCostWithOverrides(
    allPieces,
    cutoutTypes,
    cutoutRateOverrides
  );

  // Recalculate materials with rate overrides
  const finalMaterialBreakdown = calculateMaterialCostWithOverrides(
    allPieces,
    thicknessOptions,
    materialRateOverrides
  );

  // Apply percentage/fixed discounts on top of rate overrides
  const finalMaterialTotal = Math.max(0, finalMaterialBreakdown.subtotal - materialDiscount);
  const finalEdgeTotal = Math.max(0, finalEdgeData.subtotal - edgeDiscount);
  const finalCutoutTotal = Math.max(0, finalCutoutData.subtotal - cutoutDiscount);

  const subtotal = materialBreakdown.subtotal + edgeData.subtotal + cutoutData.subtotal;
  const totalDiscount =
    (materialBreakdown.subtotal - finalMaterialTotal) +
    (edgeData.subtotal - finalEdgeTotal) +
    (cutoutData.subtotal - finalCutoutTotal);
  const total = finalMaterialTotal + finalEdgeTotal + finalCutoutTotal;

  // Fetch price book info if applicable
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
    totalDiscount: roundToTwo(totalDiscount),
    total: roundToTwo(total),
    breakdown: {
      materials: {
        ...finalMaterialBreakdown,
        discount: roundToTwo(materialBreakdown.subtotal - finalMaterialTotal),
        total: roundToTwo(finalMaterialTotal),
      },
      edges: {
        totalLinearMeters: roundToTwo(finalEdgeData.totalLinearMeters),
        byType: finalEdgeData.byType,
        subtotal: roundToTwo(edgeData.subtotal),
        discount: roundToTwo(edgeData.subtotal - finalEdgeTotal),
        total: roundToTwo(finalEdgeTotal),
      },
      cutouts: {
        items: finalCutoutData.items,
        subtotal: roundToTwo(cutoutData.subtotal),
        discount: roundToTwo(cutoutData.subtotal - finalCutoutTotal),
        total: roundToTwo(finalCutoutTotal),
      },
    },
    appliedRules,
    discounts,
    priceBook: priceBookInfo,
    calculatedAt: new Date(),
  };
}

/**
 * Get applicable pricing rules based on customer classification and quote value
 */
async function getApplicableRules(
  clientTypeId: string | null,
  clientTierId: string | null,
  customerId: number | null,
  priceBookId: string | null,
  quoteTotal: number
): Promise<PricingRuleWithOverrides[]> {
  // Build the where clause for matching rules
  const conditions: Array<Record<string, unknown>> = [];

  // Always include rules with no specific conditions (default rules)
  conditions.push({
    clientTypeId: null,
    clientTierId: null,
    customerId: null,
  });

  // Include customer-specific rules
  if (customerId) {
    conditions.push({ customerId });
  }

  // Include client type rules
  if (clientTypeId) {
    conditions.push({ clientTypeId, clientTierId: null, customerId: null });
  }

  // Include client tier rules
  if (clientTierId) {
    conditions.push({ clientTierId, customerId: null });
  }

  // Include combined type + tier rules
  if (clientTypeId && clientTierId) {
    conditions.push({ clientTypeId, clientTierId, customerId: null });
  }

  // Fetch rules matching conditions
  let rules = await prisma.pricingRule.findMany({
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

  // Also fetch rules from the price book
  if (priceBookId) {
    const priceBookRules = await prisma.priceBookRule.findMany({
      where: { priceBookId },
      include: {
        pricingRule: {
          include: {
            clientTier: true,
            edgeOverrides: true,
            cutoutOverrides: true,
            materialOverrides: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Merge price book rules with other rules
    const priceBookRuleIds = new Set(priceBookRules.map((pbr: typeof priceBookRules[number]) => pbr.pricingRuleId));
    rules = rules.filter((r: typeof rules[number]) => !priceBookRuleIds.has(r.id));
    rules = [...rules, ...priceBookRules.map((pbr: typeof priceBookRules[number]) => pbr.pricingRule).filter((r: typeof rules[number]) => r.isActive)];
  }

  // Filter by quote value thresholds
  rules = rules.filter((rule: typeof rules[number]) => {
    if (rule.minQuoteValue && quoteTotal < rule.minQuoteValue.toNumber()) {
      return false;
    }
    if (rule.maxQuoteValue && quoteTotal > rule.maxQuoteValue.toNumber()) {
      return false;
    }
    return true;
  });

  // Calculate effective priority for each rule
  const rulesWithPriority = rules.map((rule: typeof rules[number]) => {
    let effectivePriority = rule.priority;

    // Customer-specific rules get highest priority
    if (rule.customerId) {
      effectivePriority = Math.max(effectivePriority, PRIORITY.CUSTOMER_SPECIFIC);
    }
    // Tier-based rules use tier's priority
    else if (rule.clientTierId && rule.clientTier) {
      effectivePriority = Math.max(effectivePriority, rule.clientTier.priority);
    }
    // Client type rules get base priority
    else if (rule.clientTypeId) {
      effectivePriority = Math.max(effectivePriority, PRIORITY.CLIENT_TYPE);
    }
    // Volume-based rules
    else if (rule.minQuoteValue || rule.maxQuoteValue) {
      effectivePriority = Math.max(effectivePriority, PRIORITY.VOLUME_BASED);
    }

    return { ...rule, effectivePriority };
  });

  // Sort by effective priority (highest first)
  rulesWithPriority.sort((a: { effectivePriority: number }, b: { effectivePriority: number }) => b.effectivePriority - a.effectivePriority);

  return rulesWithPriority as PricingRuleWithOverrides[];
}

/**
 * Calculate material cost from pieces
 * Area = (length × width) / 1,000,000 for m²
 */
function calculateMaterialCost(
  pieces: Array<{
    lengthMm: number;
    widthMm: number;
    thicknessMm: number;
    material: { pricePerSqm: { toNumber: () => number } } | null;
  }>,
  thicknessOptions: Array<{ value: number; multiplier: { toNumber: () => number } }>
): MaterialBreakdown {
  let totalAreaM2 = 0;
  let subtotal = 0;
  let weightedBaseRate = 0;
  let weightedMultiplier = 0;

  for (const piece of pieces) {
    // Calculate area in m²
    const areaSqm = (piece.lengthMm * piece.widthMm) / 1_000_000;
    totalAreaM2 += areaSqm;

    // Get base rate from material
    const baseRate = piece.material?.pricePerSqm.toNumber() ?? 0;

    // Find thickness multiplier
    const thicknessOpt = thicknessOptions.find(t => t.value === piece.thicknessMm);
    const multiplier = thicknessOpt?.multiplier.toNumber() ?? 1;

    // Calculate piece cost
    const pieceCost = areaSqm * baseRate * multiplier;
    subtotal += pieceCost;

    // Track weighted averages for breakdown
    weightedBaseRate += baseRate * areaSqm;
    weightedMultiplier += multiplier * areaSqm;
  }

  const avgBaseRate = totalAreaM2 > 0 ? weightedBaseRate / totalAreaM2 : 0;
  const avgMultiplier = totalAreaM2 > 0 ? weightedMultiplier / totalAreaM2 : 1;
  const appliedRate = avgBaseRate * avgMultiplier;

  return {
    totalAreaM2: roundToTwo(totalAreaM2),
    baseRate: roundToTwo(avgBaseRate),
    thicknessMultiplier: roundToTwo(avgMultiplier),
    appliedRate: roundToTwo(appliedRate),
    subtotal: roundToTwo(subtotal),
    discount: 0,
    total: roundToTwo(subtotal),
  };
}

/**
 * Calculate material cost with rate overrides from rules
 */
function calculateMaterialCostWithOverrides(
  pieces: Array<{
    lengthMm: number;
    widthMm: number;
    thicknessMm: number;
    materialId: number | null;
    material: { id: number; pricePerSqm: { toNumber: () => number } } | null;
  }>,
  thicknessOptions: Array<{ value: number; multiplier: { toNumber: () => number } }>,
  rateOverrides: Map<number, number>
): MaterialBreakdown {
  let totalAreaM2 = 0;
  let subtotal = 0;
  let weightedBaseRate = 0;
  let weightedMultiplier = 0;

  for (const piece of pieces) {
    const areaSqm = (piece.lengthMm * piece.widthMm) / 1_000_000;
    totalAreaM2 += areaSqm;

    // Check for rate override
    let baseRate = piece.material?.pricePerSqm.toNumber() ?? 0;
    if (piece.materialId && rateOverrides.has(piece.materialId)) {
      baseRate = rateOverrides.get(piece.materialId)!;
    }

    const thicknessOpt = thicknessOptions.find(t => t.value === piece.thicknessMm);
    const multiplier = thicknessOpt?.multiplier.toNumber() ?? 1;

    const pieceCost = areaSqm * baseRate * multiplier;
    subtotal += pieceCost;

    weightedBaseRate += baseRate * areaSqm;
    weightedMultiplier += multiplier * areaSqm;
  }

  const avgBaseRate = totalAreaM2 > 0 ? weightedBaseRate / totalAreaM2 : 0;
  const avgMultiplier = totalAreaM2 > 0 ? weightedMultiplier / totalAreaM2 : 1;
  const appliedRate = avgBaseRate * avgMultiplier;

  return {
    totalAreaM2: roundToTwo(totalAreaM2),
    baseRate: roundToTwo(avgBaseRate),
    thicknessMultiplier: roundToTwo(avgMultiplier),
    appliedRate: roundToTwo(appliedRate),
    subtotal: roundToTwo(subtotal),
    discount: 0,
    total: roundToTwo(subtotal),
  };
}

/**
 * Calculate edge length for a piece
 *
 * CRITICAL: Northcoast Stone counts ONE SIDE only, NOT full perimeter
 *
 * Example: 3600 × 650mm piece with front + right edge polished
 * = 3600mm + 650mm = 4,250mm = 4.25 linear meters
 * (NOT 8.5m which would be full perimeter)
 *
 * Only sum edges that have a polish type assigned.
 * Convert mm to linear meters (divide by 1000).
 */
function calculateEdgeLength(
  piece: {
    lengthMm: number;
    widthMm: number;
    features: Array<{
      name: string;
      quantity: number;
      featurePricing: { category: string } | null;
    }>;
  }
): { edgeName: string; linearMeters: number }[] {
  const edgeFeatures: { edgeName: string; linearMeters: number }[] = [];

  for (const feature of piece.features) {
    // Check if this is an edge feature (either by category or by naming convention)
    const isEdgeFeature =
      feature.featurePricing?.category === 'edge' ||
      feature.name.toLowerCase().includes('edge') ||
      feature.name.toLowerCase().includes('polish') ||
      feature.name.toLowerCase().includes('pencil') ||
      feature.name.toLowerCase().includes('bullnose') ||
      feature.name.toLowerCase().includes('bevel') ||
      feature.name.toLowerCase().includes('miter') ||
      feature.name.toLowerCase().includes('waterfall');

    if (isEdgeFeature) {
      // The quantity field stores the linear meters
      // OR we need to calculate based on which side
      let linearMeters = feature.quantity;

      // If quantity is 1, it might mean "1 edge" and we need to use piece dimensions
      // Check if the feature name indicates which edge
      const nameLower = feature.name.toLowerCase();
      if (feature.quantity === 1 || feature.quantity === 0) {
        if (nameLower.includes('front') || nameLower.includes('long') || nameLower.includes('length')) {
          linearMeters = piece.lengthMm / 1000;
        } else if (nameLower.includes('side') || nameLower.includes('short') || nameLower.includes('width') || nameLower.includes('right') || nameLower.includes('left')) {
          linearMeters = piece.widthMm / 1000;
        } else if (nameLower.includes('back')) {
          linearMeters = piece.lengthMm / 1000;
        }
      }

      // Extract the edge type name (e.g., "Pencil Round" from "Pencil Round - Front Edge")
      const edgeName = extractEdgeTypeName(feature.name);

      edgeFeatures.push({
        edgeName,
        linearMeters,
      });
    }
  }

  return edgeFeatures;
}

/**
 * Extract the edge type name from a feature name
 * e.g., "Pencil Round - Front Edge" → "Pencil Round"
 */
function extractEdgeTypeName(featureName: string): string {
  // Common patterns to remove
  const patterns = [
    / - front edge/i,
    / - back edge/i,
    / - left edge/i,
    / - right edge/i,
    / - long edge/i,
    / - short edge/i,
    / edge$/i,
    / - front/i,
    / - back/i,
    / - left/i,
    / - right/i,
  ];

  let name = featureName;
  for (const pattern of patterns) {
    name = name.replace(pattern, '');
  }
  return name.trim();
}

/**
 * Calculate edge costs grouped by type
 */
function calculateEdgeCost(
  pieces: Array<{
    lengthMm: number;
    widthMm: number;
    features: Array<{
      name: string;
      quantity: number;
      featurePricing: { category: string } | null;
    }>;
  }>,
  edgeTypes: EdgeTypeWithRate[]
): { totalLinearMeters: number; byType: EdgeBreakdown[]; subtotal: number } {
  // Aggregate edge lengths by type
  const edgeTotals = new Map<string, { linearMeters: number; edgeType: EdgeTypeWithRate | null }>();

  for (const piece of pieces) {
    const edges = calculateEdgeLength(piece);
    for (const edge of edges) {
      // Find matching edge type
      const edgeType = edgeTypes.find(
        et => et.name.toLowerCase() === edge.edgeName.toLowerCase()
      ) || null;

      const typeKey = edgeType?.id || edge.edgeName;
      const existing = edgeTotals.get(typeKey) || { linearMeters: 0, edgeType };
      existing.linearMeters += edge.linearMeters;
      edgeTotals.set(typeKey, existing);
    }
  }

  // Build breakdown
  const byType: EdgeBreakdown[] = [];
  let totalLinearMeters = 0;
  let subtotal = 0;

  const entries = Array.from(edgeTotals.entries());
  for (let i = 0; i < entries.length; i++) {
    const [key, data] = entries[i];
    const baseRate = data.edgeType?.baseRate.toNumber() ?? 0;
    const itemSubtotal = data.linearMeters * baseRate;

    byType.push({
      edgeTypeId: data.edgeType?.id || key,
      edgeTypeName: data.edgeType?.name || key,
      linearMeters: roundToTwo(data.linearMeters),
      baseRate: roundToTwo(baseRate),
      appliedRate: roundToTwo(baseRate),
      subtotal: roundToTwo(itemSubtotal),
    });

    totalLinearMeters += data.linearMeters;
    subtotal += itemSubtotal;
  }

  return { totalLinearMeters, byType, subtotal };
}

/**
 * Calculate edge costs with rate overrides
 */
function calculateEdgeCostWithOverrides(
  pieces: Array<{
    lengthMm: number;
    widthMm: number;
    features: Array<{
      name: string;
      quantity: number;
      featurePricing: { category: string } | null;
    }>;
  }>,
  edgeTypes: EdgeTypeWithRate[],
  rateOverrides: Map<string, number>
): { totalLinearMeters: number; byType: EdgeBreakdown[]; subtotal: number } {
  const edgeTotals = new Map<string, { linearMeters: number; edgeType: EdgeTypeWithRate | null }>();

  for (const piece of pieces) {
    const edges = calculateEdgeLength(piece);
    for (const edge of edges) {
      const edgeType = edgeTypes.find(
        et => et.name.toLowerCase() === edge.edgeName.toLowerCase()
      ) || null;

      const typeKey = edgeType?.id || edge.edgeName;
      const existing = edgeTotals.get(typeKey) || { linearMeters: 0, edgeType };
      existing.linearMeters += edge.linearMeters;
      edgeTotals.set(typeKey, existing);
    }
  }

  const byType: EdgeBreakdown[] = [];
  let totalLinearMeters = 0;
  let subtotal = 0;

  const entries = Array.from(edgeTotals.entries());
  for (let i = 0; i < entries.length; i++) {
    const [key, data] = entries[i];
    const baseRate = data.edgeType?.baseRate.toNumber() ?? 0;
    // Check for rate override
    const appliedRate = rateOverrides.has(key) ? rateOverrides.get(key)! : baseRate;
    const itemSubtotal = data.linearMeters * appliedRate;

    byType.push({
      edgeTypeId: data.edgeType?.id || key,
      edgeTypeName: data.edgeType?.name || key,
      linearMeters: roundToTwo(data.linearMeters),
      baseRate: roundToTwo(baseRate),
      appliedRate: roundToTwo(appliedRate),
      subtotal: roundToTwo(itemSubtotal),
    });

    totalLinearMeters += data.linearMeters;
    subtotal += itemSubtotal;
  }

  return { totalLinearMeters, byType, subtotal };
}

/**
 * Calculate cutout costs from pieces
 */
function calculateCutoutCost(
  pieces: Array<{
    features: Array<{
      name: string;
      quantity: number;
      featurePricing: { category: string } | null;
    }>;
  }>,
  cutoutTypes: CutoutTypeWithRate[]
): { items: CutoutBreakdown[]; subtotal: number } {
  // Aggregate cutouts by type
  const cutoutTotals = new Map<string, { quantity: number; cutoutType: CutoutTypeWithRate | null }>();

  for (const piece of pieces) {
    for (const feature of piece.features) {
      // Check if this is a cutout feature
      const isCutoutFeature =
        feature.featurePricing?.category === 'cutout' ||
        feature.name.toLowerCase().includes('cutout') ||
        feature.name.toLowerCase().includes('sink') ||
        feature.name.toLowerCase().includes('tap hole') ||
        feature.name.toLowerCase().includes('cooktop') ||
        feature.name.toLowerCase().includes('powerpoint');

      if (isCutoutFeature) {
        const cutoutName = extractCutoutTypeName(feature.name);
        const cutoutType = cutoutTypes.find(
          ct => ct.name.toLowerCase() === cutoutName.toLowerCase()
        ) || null;

        const typeKey = cutoutType?.id || cutoutName;
        const existing = cutoutTotals.get(typeKey) || { quantity: 0, cutoutType };
        existing.quantity += feature.quantity || 1;
        cutoutTotals.set(typeKey, existing);
      }
    }
  }

  // Build breakdown
  const items: CutoutBreakdown[] = [];
  let subtotal = 0;

  const entries = Array.from(cutoutTotals.entries());
  for (let i = 0; i < entries.length; i++) {
    const [key, data] = entries[i];
    const basePrice = data.cutoutType?.baseRate.toNumber() ?? 0;
    const itemSubtotal = data.quantity * basePrice;

    items.push({
      cutoutTypeId: data.cutoutType?.id || key,
      cutoutTypeName: data.cutoutType?.name || key,
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
 * Calculate cutout costs with rate overrides
 */
function calculateCutoutCostWithOverrides(
  pieces: Array<{
    features: Array<{
      name: string;
      quantity: number;
      featurePricing: { category: string } | null;
    }>;
  }>,
  cutoutTypes: CutoutTypeWithRate[],
  rateOverrides: Map<string, number>
): { items: CutoutBreakdown[]; subtotal: number } {
  const cutoutTotals = new Map<string, { quantity: number; cutoutType: CutoutTypeWithRate | null }>();

  for (const piece of pieces) {
    for (const feature of piece.features) {
      const isCutoutFeature =
        feature.featurePricing?.category === 'cutout' ||
        feature.name.toLowerCase().includes('cutout') ||
        feature.name.toLowerCase().includes('sink') ||
        feature.name.toLowerCase().includes('tap hole') ||
        feature.name.toLowerCase().includes('cooktop') ||
        feature.name.toLowerCase().includes('powerpoint');

      if (isCutoutFeature) {
        const cutoutName = extractCutoutTypeName(feature.name);
        const cutoutType = cutoutTypes.find(
          ct => ct.name.toLowerCase() === cutoutName.toLowerCase()
        ) || null;

        const typeKey = cutoutType?.id || cutoutName;
        const existing = cutoutTotals.get(typeKey) || { quantity: 0, cutoutType };
        existing.quantity += feature.quantity || 1;
        cutoutTotals.set(typeKey, existing);
      }
    }
  }

  const items: CutoutBreakdown[] = [];
  let subtotal = 0;

  const entries = Array.from(cutoutTotals.entries());
  for (let i = 0; i < entries.length; i++) {
    const [key, data] = entries[i];
    const basePrice = data.cutoutType?.baseRate.toNumber() ?? 0;
    const appliedPrice = rateOverrides.has(key) ? rateOverrides.get(key)! : basePrice;
    const itemSubtotal = data.quantity * appliedPrice;

    items.push({
      cutoutTypeId: data.cutoutType?.id || key,
      cutoutTypeName: data.cutoutType?.name || key,
      quantity: data.quantity,
      basePrice: roundToTwo(basePrice),
      appliedPrice: roundToTwo(appliedPrice),
      subtotal: roundToTwo(itemSubtotal),
    });

    subtotal += itemSubtotal;
  }

  return { items, subtotal };
}

/**
 * Extract cutout type name from feature name
 */
function extractCutoutTypeName(featureName: string): string {
  // Common patterns to remove
  const patterns = [
    / cutout$/i,
    / cut-out$/i,
    / hole$/i,
  ];

  let name = featureName;
  for (const pattern of patterns) {
    name = name.replace(pattern, '');
  }
  return name.trim();
}

/**
 * Apply pricing rules to calculate discounts
 *
 * Rule types:
 * - percentage: % off category or total
 * - fixed_amount: fixed amount off
 * - price_override: replace base price entirely (via overrides)
 * - multiplier: multiply category subtotal
 */
function applyRules(
  materialSubtotal: number,
  edgeSubtotal: number,
  cutoutSubtotal: number,
  rules: PricingRuleWithOverrides[]
): {
  materialDiscount: number;
  edgeDiscount: number;
  cutoutDiscount: number;
  appliedRules: AppliedRule[];
  discounts: DiscountBreakdown[];
  edgeRateOverrides: Map<string, number>;
  cutoutRateOverrides: Map<string, number>;
  materialRateOverrides: Map<number, number>;
} {
  let materialDiscount = 0;
  let edgeDiscount = 0;
  let cutoutDiscount = 0;
  const appliedRules: AppliedRule[] = [];
  const discounts: DiscountBreakdown[] = [];
  const edgeRateOverrides = new Map<string, number>();
  const cutoutRateOverrides = new Map<string, number>();
  const materialRateOverrides = new Map<number, number>();

  // Track which categories have been adjusted by higher-priority rules
  const adjustedCategories = new Set<string>();

  for (const rule of rules) {
    const adjustmentValue = rule.adjustmentValue.toNumber();
    const appliesTo = rule.appliesTo;

    // Skip if this category was already adjusted by a higher-priority rule
    // (unless this rule applies to 'all')
    if (appliesTo !== 'all' && adjustedCategories.has(appliesTo)) {
      continue;
    }

    // Process specific overrides first (price_override type)
    // Edge overrides
    for (const override of rule.edgeOverrides) {
      if (override.customRate) {
        edgeRateOverrides.set(override.edgeTypeId, override.customRate.toNumber());
      }
    }

    // Cutout overrides
    for (const override of rule.cutoutOverrides) {
      if (override.customRate) {
        cutoutRateOverrides.set(override.cutoutTypeId, override.customRate.toNumber());
      }
    }

    // Material overrides
    for (const override of rule.materialOverrides) {
      if (override.customRate) {
        materialRateOverrides.set(override.materialId, override.customRate.toNumber());
      }
    }

    // Apply general adjustments
    let effect = '';
    let savings = 0;

    if (rule.adjustmentType === 'percentage') {
      const percentage = Math.abs(adjustmentValue);

      if (appliesTo === 'all' || appliesTo === 'materials') {
        const discount = (materialSubtotal * percentage) / 100;
        materialDiscount += discount;
        savings += discount;
        if (!adjustedCategories.has('materials')) adjustedCategories.add('materials');
      }
      if (appliesTo === 'all' || appliesTo === 'edges') {
        const discount = (edgeSubtotal * percentage) / 100;
        edgeDiscount += discount;
        savings += discount;
        if (!adjustedCategories.has('edges')) adjustedCategories.add('edges');
      }
      if (appliesTo === 'all' || appliesTo === 'cutouts') {
        const discount = (cutoutSubtotal * percentage) / 100;
        cutoutDiscount += discount;
        savings += discount;
        if (!adjustedCategories.has('cutouts')) adjustedCategories.add('cutouts');
      }

      effect = `${percentage}% off ${appliesTo}`;

      if (savings > 0) {
        discounts.push({
          ruleId: rule.id,
          ruleName: rule.name,
          type: 'percentage',
          value: percentage,
          appliedTo: appliesTo as 'materials' | 'edges' | 'cutouts' | 'total',
          savings: roundToTwo(savings),
        });
      }
    } else if (rule.adjustmentType === 'fixed_amount') {
      const fixedAmount = Math.abs(adjustmentValue);

      if (appliesTo === 'all') {
        // Distribute fixed discount proportionally
        const total = materialSubtotal + edgeSubtotal + cutoutSubtotal;
        if (total > 0) {
          materialDiscount += (fixedAmount * materialSubtotal) / total;
          edgeDiscount += (fixedAmount * edgeSubtotal) / total;
          cutoutDiscount += (fixedAmount * cutoutSubtotal) / total;
          savings = fixedAmount;
        }
      } else if (appliesTo === 'materials') {
        materialDiscount += fixedAmount;
        savings = fixedAmount;
        adjustedCategories.add('materials');
      } else if (appliesTo === 'edges') {
        edgeDiscount += fixedAmount;
        savings = fixedAmount;
        adjustedCategories.add('edges');
      } else if (appliesTo === 'cutouts') {
        cutoutDiscount += fixedAmount;
        savings = fixedAmount;
        adjustedCategories.add('cutouts');
      }

      effect = `$${fixedAmount.toFixed(2)} off ${appliesTo}`;

      if (savings > 0) {
        discounts.push({
          ruleId: rule.id,
          ruleName: rule.name,
          type: 'fixed',
          value: fixedAmount,
          appliedTo: appliesTo as 'materials' | 'edges' | 'cutouts' | 'total',
          savings: roundToTwo(savings),
        });
      }
    }

    // Record that this rule was applied
    if (effect || rule.edgeOverrides.length > 0 || rule.cutoutOverrides.length > 0 || rule.materialOverrides.length > 0) {
      const overrideEffects: string[] = [];
      if (rule.edgeOverrides.length > 0) overrideEffects.push('edge rate overrides');
      if (rule.cutoutOverrides.length > 0) overrideEffects.push('cutout rate overrides');
      if (rule.materialOverrides.length > 0) overrideEffects.push('material rate overrides');

      const fullEffect = [effect, ...overrideEffects].filter(Boolean).join(', ');

      appliedRules.push({
        ruleId: rule.id,
        ruleName: rule.name,
        priority: rule.priority,
        effect: fullEffect || 'No direct adjustment',
      });
    }
  }

  return {
    materialDiscount,
    edgeDiscount,
    cutoutDiscount,
    appliedRules,
    discounts,
    edgeRateOverrides,
    cutoutRateOverrides,
    materialRateOverrides,
  };
}

/**
 * Round a number to 2 decimal places
 */
function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
}
