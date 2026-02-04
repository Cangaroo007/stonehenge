/**
 * Tiered Pricing & Discount System Types
 * Types for the PriceTier and TierDiscountRule models
 */

import type { DiscountCategory, DiscountDisplayMode } from '@prisma/client';

// ============================================
// ENUMS (mirroring Prisma for use in client code)
// ============================================

export const DISCOUNT_CATEGORIES: DiscountCategory[] = [
  'SLAB',
  'CUTTING',
  'POLISHING',
  'CUTOUT',
  'DELIVERY',
  'INSTALLATION',
  'OTHER',
];

export const DISCOUNT_DISPLAY_MODES: DiscountDisplayMode[] = [
  'TOTAL_ONLY',
  'ITEMIZED',
];

// ============================================
// CORE INTERFACES
// ============================================

export interface PriceTier {
  id: string;
  name: string;
  isDefault: boolean;
  organisationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TierDiscountRule {
  id: string;
  tierId: string;
  category: DiscountCategory;
  discountPercent: number;
  isExcluded: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// RELATIONS / COMPOSITE TYPES
// ============================================

export interface PriceTierWithRules extends PriceTier {
  discountRules: TierDiscountRule[];
}

export interface PriceTierSummary {
  id: string;
  name: string;
  isDefault: boolean;
  ruleCount: number;
  customerCount: number;
}

// ============================================
// API REQUEST / RESPONSE TYPES
// ============================================

export interface CreatePriceTierInput {
  name: string;
  isDefault?: boolean;
  organisationId: string;
  discountRules?: CreateTierDiscountRuleInput[];
}

export interface UpdatePriceTierInput {
  name?: string;
  isDefault?: boolean;
}

export interface CreateTierDiscountRuleInput {
  category: DiscountCategory;
  discountPercent: number;
  isExcluded?: boolean;
}

export interface UpdateTierDiscountRuleInput {
  discountPercent?: number;
  isExcluded?: boolean;
}

// ============================================
// QUOTE DISCOUNT CONTEXT
// ============================================

export interface QuoteTierContext {
  priceTierId: string | null;
  managerReviewRequired: boolean;
  discountDisplayMode: DiscountDisplayMode;
}

export interface TierDiscountApplication {
  tierId: string;
  tierName: string;
  appliedRules: AppliedTierDiscount[];
  totalDiscountAmount: number;
}

export interface AppliedTierDiscount {
  category: DiscountCategory;
  discountPercent: number;
  isExcluded: boolean;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
}

// ============================================
// HELPERS FOR PRISMA JSON FIELDS
// ============================================

/**
 * Safely cast a Prisma JSON field to a typed object.
 * Uses the double-cast pattern: `value as unknown as MyType`
 *
 * @example
 * const breakdown = castJsonField<TierDiscountApplication>(quote.calculationBreakdown);
 */
export function castJsonField<T>(value: unknown): T {
  return value as unknown as T;
}
