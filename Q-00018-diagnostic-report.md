# Stone Henge — Full Diagnostic Report for Quote Q-00018

**Date:** 2026-02-04
**Quote:** Q-00018 — GemLife Highfields Heights (Builder, Tier 1)
**Project Address:** 25 Bognuda Street
**Pieces:** 7 detected from drawing analysis

---

## 1. DATABASE DIAGNOSTICS (Steps 1-5)

**Status: BLOCKED** — No `DATABASE_URL` or `.env` file available in the diagnostic environment. Cannot run live queries against the database. The analysis below is based on thorough code-level inspection of the schema, seed data, calculator logic, and frontend components.

---

## 2. QUOTE BUILDER FRONTEND — PRICING LAYOUT

### Page Structure

**File:** `src/app/(dashboard)/quotes/[id]/builder/page.tsx`

3-column responsive grid:
- **Left (2 cols):** Pieces list + slab optimization display
- **Right (1 col):** Piece editor, PricingSummary panel, piece statistics

### PricingSummary Component (715 lines)

**File:** `src/app/(dashboard)/quotes/[id]/builder/components/PricingSummary.tsx`

This is the main pricing panel. It calls `POST /api/quotes/{id}/calculate` on a 500ms debounce whenever pieces change, and renders these sections in order:

1. **View Toggle** — "Itemized" vs "Total Only" discount display mode
2. **Customer Info** — Name, type, tier badge (color-coded: Tier 1=green, Tier 2=blue), price book
3. **SLABS** — Total area, base rate (per m² or per slab with thickness multiplier), base price, tier discount (itemized mode), total
4. **CUTTING (Cutouts)** — Each cutout type × quantity × rate, base price, tier discount, total
5. **POLISHING (Edges)** — By edge type: `{name}: {linearMeters} lm × {appliedRate} = {subtotal}`, base price, tier discount, total
6. **PER-PIECE BREAKDOWN** (itemized mode only) — Expandable rows per piece showing fabrication breakdown (cutting, polishing, edges, cutouts with line-through on discounted amounts)
7. **DELIVERY** — Address, distance, zone, override cost, final cost
8. **TEMPLATING** — Distance, override, final cost
9. **TIER DISCOUNTS** — Each applied rule with name, type, savings (green checkmarks)
10. **ADDITIONAL DISCOUNT** — Manual % or $ input with live calculation
11. **TOTALS** — Subtotal → Total Savings → Adjusted Subtotal → GST (10%) → **Grand Total**

### Supporting Components

| Component | File | Purpose |
|-----------|------|---------|
| `PieceList` | `PieceList.tsx` (539 lines) | Tabular piece list with inline editing, material display, lamination/mitre strip indicators |
| `PieceForm` | `PieceForm.tsx` | Piece editor integrating EdgeSelector and CutoutSelector |
| `EdgeSelector` | `EdgeSelector.tsx` | Visual 4-side edge picker, calculates total meters and estimated cost |
| `CutoutSelector` | `CutoutSelector.tsx` | Cutout management with pricing display |
| `DeliveryTemplatingCard` | `DeliveryTemplatingCard.tsx` | Delivery/templating inputs with distance calculator, manual override |
| `OptimizationDisplay` | `OptimizationDisplay.tsx` | Slab optimization results, waste % (color-coded) |
| `QuoteTotals` | `QuoteTotals.tsx` | Alternative/legacy totals display |
| `MaterialsBreakdown` | `MaterialsBreakdown.tsx` | Legacy materials display |

### Pricing Flow

```
User edits piece → refreshTrigger increments
  → PricingSummary useEffect (500ms debounce)
  → POST /api/quotes/[id]/calculate
  → pricing-calculator-v2.ts runs full calculation
  → Returns CalculationResult with breakdown
  → PricingSummary renders all sections
```

---

## 3. PRICING ADMIN SECTION

### Admin Pages

| Page | Path | Manages |
|------|------|---------|
| **Pricing Hub** | `/admin/pricing/page.tsx` | Tabbed interface for all pricing entities |
| **Service Rates** | `/admin/pricing/services/page.tsx` | Inline editing of 20mm/40mm rates + minimum charges |
| **Settings** | `/admin/pricing/settings/page.tsx` | Material basis (PER_SLAB vs PER_SQUARE_METRE), units, tax |
| **Cutouts** | `/admin/pricing/cutouts/page.tsx` | Cutout type pricing |
| **Materials** | `/materials/page.tsx` + edit/new pages | Material library with pricePerSqm |

The **Pricing Hub** has tabs for: Edge Types, Cutout Types, Thickness Options, Strip Configurations, Machines, Client Types, Client Tiers, Pricing Rules, Price Books — each with full CRUD via `EntityTable` + modal forms.

### Admin API Routes (27 route files)

**Path:** `/api/admin/pricing/`

Full CRUD for: service-rates, edge-types, cutout-types, settings, client-tiers, client-types, pricing-rules, price-books, thickness-options, delivery-zones, templating-rates, machines, strip-configurations. All role-gated (ADMIN / SALES_MANAGER).

### Seed Data (8 scripts under `prisma/`)

| Script | Key Data |
|--------|----------|
| `seed.ts` | 10 materials, 8 edge types, 6 cutout types, 2 thickness options |
| `seed-pricing.ts` | Client types (4), client tiers (3: 15%/10%/0%), pricing rules (4), price books (3) |
| `seed-pricing-settings.ts` | **ServiceRates:** CUTTING $17.50/$45, POLISHING $45/$115, INSTALLATION $140/$170, WATERFALL_END $300/$650, TEMPLATING $150, DELIVERY $2.50/km |
| `seed-edge-types.ts` | 5 edges with thickness-specific rates (Pencil Round +$0, Bullnose +$10, Ogee +$20-25, Curved +$255-535) |
| `seed-cutout-types.ts` | 7 cutouts by category (Standard $65, Undermount $300, Flush Cooktop $450, Drainer $150) |
| `seed-delivery-templating.ts` | 3 delivery zones (Local/Regional/Remote), templating $150 base + $2/km |
| `seed-strip-configurations.ts` | 5 configs for lamination/waterfall edge cutting |

---

## 4. ADMIN → CALCULATOR → UI RELATIONSHIPS

```
ADMIN SECTION (creates/updates)
│
├── PricingSettings ──────────────→ loadPricingContext()
│     materialPricingBasis              → determines PER_SLAB vs PER_SQUARE_METRE
│     cuttingUnit, polishingUnit        → determines rate application method
│     gstRate                           → applied to final total
│
├── ServiceRate ──────────────────→ calculateServiceCostForUnit()
│     CUTTING (20mm/40mm rates)         → piece perimeter × rate = cutting cost
│     POLISHING (20mm/40mm rates)       → finished edge length × rate = polishing cost
│     INSTALLATION, WATERFALL_END       → additional service costs
│     minimumCharge                     → floor for each service
│
├── EdgeType ─────────────────────→ calculateEdgeCostV2()
│     baseRate, rate20mm, rate40mm      → per-edge linear meter cost
│     curvedEdge flag, minCharge        → premium edge handling
│
├── CutoutType ───────────────────→ cutout cost calculation
│     baseRate per cutout               → quantity × rate per type
│
├── Material ─────────────────────→ calculateMaterialCost()
│     pricePerSqm or pricePerSlab       → piece area × rate
│
├── ThicknessOption ──────────────→ thickness multiplier
│     multiplier (20mm=1.0, 40mm=1.3)  → applied to material costs
│
├── ClientType + ClientTier ──────→ discount resolution
│     fabricationDiscount               → % off fabrication
│     discountMatrix (JSON)             → per-category discounts
│     customPriceList (JSON)            → override rates
│
├── PricingRule ──────────────────→ rule evaluation engine
│     conditions (type, tier, value)    → IF customer matches
│     adjustments (%, fixed)            → THEN apply discount/override
│     PricingRuleEdge/Cutout/Material   → per-item overrides
│
├── PriceBook ────────────────────→ rule collection
│     rules in sortOrder                → evaluated by priority
│     assigned to Customer              → customer's default pricing
│
├── DeliveryZone ─────────────────→ delivery cost
│     base + per-km rate by zone        → distance-based pricing
│
└── TemplatingRate ───────────────→ templating cost
      base + per-km rate                → distance-based pricing

                    ↓
        calculateQuotePrice(quoteId)
                    ↓
        CalculationResult {
          breakdown: {
            materials, edges, cutouts,
            delivery, templating, pieces[]
          }
          appliedRules[], discounts[]
          subtotal → totalDiscount → total
        }
                    ↓
        PricingSummary.tsx renders all sections
```

---

## 5. KEY PRICING TYPE DEFINITIONS

**File:** `src/lib/types/pricing.ts` (275 lines)

### CalculationResult
```typescript
{
  quoteId: string;
  subtotal: number;
  totalDiscount: number;
  total: number;
  breakdown: {
    materials: MaterialBreakdown;
    edges: { totalLinearMeters, byType[], subtotal, discount, total };
    cutouts: { items[], subtotal, discount, total };
    delivery?: { address, distanceKm, zone, calculatedCost, overrideCost, finalCost };
    templating?: { required, distanceKm, calculatedCost, overrideCost, finalCost };
    pieces?: PiecePricingBreakdown[];
  };
  appliedRules: AppliedRule[];
  discounts: DiscountBreakdown[];
  priceBook: { id, name } | null;
  calculatedAt: Date;
}
```

### PiecePricingBreakdown
```typescript
{
  pieceId: number;
  pieceName: string;
  dimensions: { lengthMm, widthMm, thicknessMm };
  fabrication: {
    cutting: { linearMeters, rate, baseAmount, discount, total, discountPercentage };
    polishing: { linearMeters, rate, baseAmount, discount, total, discountPercentage };
    edges: Array<{
      side, edgeTypeId, edgeTypeName, lengthMm, linearMeters,
      rate, baseAmount, discount, total, discountPercentage
    }>;
    cutouts: Array<{
      cutoutTypeId, cutoutTypeName, quantity,
      rate, baseAmount, discount, total
    }>;
    subtotal: number;
  };
  materials?: {
    areaM2, baseRate, thicknessMultiplier,
    baseAmount, discount, total, discountPercentage
  };
  pieceTotal: number;
}
```

---

## 6. PRICING CALCULATOR ENGINE

**File:** `src/lib/services/pricing-calculator-v2.ts` (971 lines)

### Key Functions

| Function | Purpose |
|----------|---------|
| `loadPricingContext()` | Loads org-level PricingSettings, falls back to defaults |
| `calculateMaterialCost()` | PER_SLAB or PER_SQUARE_METRE with thickness multiplier |
| `calculateServiceCostForUnit()` | Applies 20mm vs 40mm+ rate based on piece thickness |
| `calculateEdgeCostV2()` | Reads edgeTop/Bottom/Left/Right → looks up EdgeType → linear meters × rate |
| `calculateQuotePrice()` | Main entry point: loads quote, customer, rules, calculates everything |

### Rule Evaluation Order
1. Load customer's ClientType and ClientTier
2. Load assigned PriceBook (or customer's default)
3. Evaluate PricingRules by priority (highest first)
4. Check conditions (clientTypeId, clientTierId, minQuoteValue, thicknessValue)
5. Apply adjustments (percentage or fixed) to specified categories
6. Per-item overrides (PricingRuleEdge, PricingRuleCutout, PricingRuleMaterial)

---

## 7. DRAWING IMPORT FLOW — WHERE EDGES GET LOST

### Step-by-step trace

1. **AI Analysis** (`/api/analyze-drawing/route.ts` lines 47-107)
   - Claude prompt asks for: dimensions, cutouts, rooms, shapes, confidence
   - **Does NOT ask for edge/polish finish information**
   - No `edges` field in the output JSON schema

2. **Review Step** (`DrawingImport.tsx` line 391)
   - Analysis results mapped to `ExtractedPiece[]`
   - Edge selections initialized as: `{ edgeTop: null, edgeBottom: null, edgeLeft: null, edgeRight: null }`
   - EdgeSelector UI exists per piece but requires user to expand each piece and manually pick edges

3. **Import** (`/api/quotes/[id]/import-pieces`)
   - Pieces created with whatever edge values were in the request
   - If user didn't manually set edges during review → null

4. **Pricing Calculator** (`pricing-calculator-v2.ts`)
   - `calculateEdgeCostV2()` reads `edgeTop`/`edgeBottom`/`edgeLeft`/`edgeRight`
   - Null edges = no polishing = $0.00
   - This is correct behavior given the input data

5. **PricingSummary UI**
   - Correctly displays what the calculator returns
   - POLISHING section shows $0.00 because calculator returned $0.00

---

## 8. ROOT CAUSE ANALYSIS

### The Edge/Polishing $0 Problem

| Layer | Working? | Issue |
|-------|----------|-------|
| ServiceRate data | Likely YES (cutting shows costs) | Needs DB confirmation |
| EdgeType data | Likely YES | Needs DB confirmation |
| AI drawing analysis | YES, but incomplete | Does not extract edge info from drawings |
| Drawing import review | YES, but edges default to null | No bulk-assign, no AI edge detection |
| Pricing calculator | YES | Correctly returns $0 for null edges |
| PricingSummary UI | YES | Correctly displays what calculator returns |

### Root Cause

**This is not a bug — it is a missing feature.** The AI drawing analysis does not extract edge/polish information from drawings, and users are not being prompted or guided to set edges before or after import. The pricing system is working correctly with the data it receives.

The gap is at the boundary between drawing import and piece creation:
- The AI extracts dimensions, cutouts, and room assignments
- Edge finish (polished, pencil round, bullnose, etc.) is a fabrication decision made during quoting
- The UI supports manual edge selection per-piece, but there is no bulk-assign or default-edge feature

---

## 9. RECOMMENDED FIXES

### Option A: Bulk Edge Assignment (Quick Win)
Add a "Set default edges for all pieces" control in the DrawingImport review step. User picks an edge type and which sides to apply it to, and it populates all selected pieces before import.

### Option B: AI Edge Detection (Enhancement)
Add edge extraction to the `/api/analyze-drawing` prompt. Many CAD drawings and job sheets annotate polished edges with markers like "PR" (Pencil Round), "BN" (Bullnose), or bold/thick lines. The AI could detect these and pre-populate edge selections.

### Option C: Post-Import Guidance (UX Improvement)
After importing pieces from a drawing, show a prompt/banner: "Edges not set for imported pieces — set edges now?" linking to a bulk edge editor. The PieceForm and EdgeSelector already support this; the gap is discoverability.

---

## 10. KEY FILE REFERENCE

### Quote Builder Frontend
| File | Lines | Purpose |
|------|-------|---------|
| `src/app/(dashboard)/quotes/[id]/builder/page.tsx` | 773 | Main page layout |
| `.../builder/components/PricingSummary.tsx` | 715 | Main pricing panel |
| `.../builder/components/PieceList.tsx` | 539 | Piece table with inline editing |
| `.../builder/components/PieceForm.tsx` | ~200 | Piece editor with edge/cutout selectors |
| `.../builder/components/EdgeSelector.tsx` | ~80 | 4-side edge picker with cost preview |
| `.../builder/components/CutoutSelector.tsx` | — | Cutout management |
| `.../builder/components/DeliveryTemplatingCard.tsx` | 152 | Delivery/templating inputs |
| `.../builder/components/DrawingImport.tsx` | 983 | Drawing upload, AI analysis, piece import |
| `.../builder/components/OptimizationDisplay.tsx` | 193 | Slab optimization results |

### Pricing Admin
| File | Purpose |
|------|---------|
| `src/app/(dashboard)/admin/pricing/page.tsx` | Main pricing admin hub (tabbed) |
| `src/app/(dashboard)/admin/pricing/services/page.tsx` | ServiceRate management |
| `src/app/(dashboard)/admin/pricing/settings/page.tsx` | Global pricing settings |
| `src/app/api/admin/pricing/` (27 route files) | Full CRUD APIs |

### Pricing Engine
| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/services/pricing-calculator-v2.ts` | 971 | Main calculation engine |
| `src/lib/types/pricing.ts` | 275 | All pricing type definitions |
| `src/app/api/quotes/[id]/calculate/route.ts` | 124 | Calculation API endpoint |

### Schema & Seeds
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | 1130 lines — all models |
| `prisma/seed-pricing-settings.ts` | ServiceRates with actual dollar values |
| `prisma/seed-edge-types.ts` | EdgeType rates by thickness |
| `prisma/seed-cutout-types.ts` | CutoutType rates by category |
| `prisma/seed-pricing.ts` | Client tiers, pricing rules, price books |
