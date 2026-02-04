/**
 * UI Contract Types
 *
 * Interfaces that bridge the pricing engine and the UI layer.
 * These types extend/map from the core pricing types in ./pricing.ts
 * rather than duplicating them.
 */

import type {
  CalculationResult,
  PiecePricingBreakdown,
  MaterialBreakdown,
  EdgeBreakdown,
  CutoutBreakdown,
  DiscountBreakdown,
  AppliedRule,
} from './pricing';

// ============================================
// QUOTE DISPLAY DATA
// ============================================

/** Status badge variants for quote lifecycle */
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface StatusBadge {
  label: string;
  variant: 'default' | 'info' | 'success' | 'warning' | 'destructive';
}

/** Map from QuoteStatus to badge presentation */
export const QUOTE_STATUS_BADGES: Record<QuoteStatus, StatusBadge> = {
  draft: { label: 'Draft', variant: 'default' },
  sent: { label: 'Sent', variant: 'info' },
  accepted: { label: 'Accepted', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  expired: { label: 'Expired', variant: 'warning' },
};

/** Formatted currency string helper type */
export interface FormattedCurrency {
  raw: number;
  formatted: string;
  currency: string;
}

/**
 * UI-optimized version of a quote for display purposes.
 * Wraps CalculationResult with formatted strings and status logic.
 */
export interface QuoteDisplayData {
  /** Source calculation result from the pricing engine */
  calculation: CalculationResult;

  /** Quote metadata */
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  status: QuoteStatus;
  statusBadge: StatusBadge;

  /** Pre-formatted currency values for direct rendering */
  formattedSubtotal: FormattedCurrency;
  formattedDiscount: FormattedCurrency;
  formattedTotal: FormattedCurrency;

  /** Summary counts for the quote header */
  totalPieces: number;
  totalRooms: number;

  /** Applied pricing rules summary */
  appliedRules: AppliedRule[];
  discounts: DiscountBreakdown[];

  /** Timestamps */
  calculatedAt: Date;
  updatedAt: Date;
}

// ============================================
// SLAB OPTIMIZER STATE
// ============================================

/** A piece positioned on a slab during optimization */
export interface PlacedPiece {
  pieceId: number;
  pieceName: string;
  /** Position on the slab in mm from top-left origin */
  x: number;
  y: number;
  /** Dimensions in mm */
  width: number;
  height: number;
  /** Whether the piece has been rotated 90 degrees for better fit */
  rotated: boolean;
}

/** Waste region on a slab after piece placement */
export interface WasteRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  areaM2: number;
}

/**
 * Tracks the current layout of pieces on a slab during optimization.
 */
export interface SlabOptimizerState {
  /** Slab dimensions in mm */
  slabWidth: number;
  slabHeight: number;
  slabThickness: number;

  /** Material info */
  materialId: number;
  materialName: string;

  /** Layout state */
  placedPieces: PlacedPiece[];
  unplacedPieceIds: number[];

  /** Utilization metrics */
  usedAreaM2: number;
  wasteAreaM2: number;
  utilizationPercent: number;
  wasteRegions: WasteRegion[];

  /** Multi-slab support */
  slabIndex: number;
  totalSlabs: number;
}

// ============================================
// PRICING BREAKDOWN VIEW
// ============================================

/** A single line item in the per-piece breakdown, showing LM vs M² pricing */
export interface PricingLineItem {
  label: string;
  /** Lineal metre measurement and cost (cutting, polishing, edges) */
  linealMetres: {
    quantity: number;
    rate: FormattedCurrency;
    total: FormattedCurrency;
  } | null;
  /** Square metre measurement and cost (materials) */
  squareMetres: {
    quantity: number;
    rate: FormattedCurrency;
    total: FormattedCurrency;
  } | null;
}

/**
 * Structured type for displaying the per-piece pricing breakdown in the UI.
 * Maps directly from PiecePricingBreakdown for rendering.
 */
export interface PricingBreakdownView {
  /** Source per-piece breakdown from the pricing engine */
  source: PiecePricingBreakdown;

  /** Piece identity */
  pieceId: number;
  pieceName: string;
  dimensionsLabel: string;

  /** Material cost section (Square Metre basis) */
  material: {
    breakdown: MaterialBreakdown;
    formattedTotal: FormattedCurrency;
  } | null;

  /** Fabrication line items (Lineal Metre basis) */
  cutting: PricingLineItem;
  polishing: PricingLineItem;
  edges: (PricingLineItem & { side: string; edgeTypeName: string })[];
  cutouts: {
    cutoutTypeName: string;
    quantity: number;
    formattedRate: FormattedCurrency;
    formattedTotal: FormattedCurrency;
  }[];

  /** Discount summary for this piece */
  discountPercent: number;
  formattedDiscount: FormattedCurrency;

  /** Piece total */
  formattedPieceTotal: FormattedCurrency;
}
