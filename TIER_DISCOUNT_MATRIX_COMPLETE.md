# Tier Management & Discount Matrix Implementation

**Date:** February 4, 2026  
**Status:** ✅ Complete

## Overview

Implemented a comprehensive Tier Management and Discount Matrix UI for the Pricing Administration area, following the Linear-inspired design system with Amber accent colors.

## What Was Built

### 1. **New Component: `TierManagement.tsx`**
Located: `src/components/pricing/TierManagement.tsx`

**Features:**
- **Tier List/Grid View:** Displays all pricing tiers in a responsive card grid
- **Create Tier Modal:** Full-featured modal for creating/editing tiers
- **Discount Matrix Table:** 6-category discount configuration system
  - Slabs
  - Cutting
  - Polishing
  - Cutouts
  - Delivery
  - Installation
- **Global Discount Field:** Across-the-board discount at the top
- **Exclusion Logic:** Checkboxes to exclude categories from global discount
- **Live Preview Calculator:** Side panel showing real-time discount calculations

**UI/UX Highlights:**
- Linear-inspired design with Zinc-50 background and Amber-600 accents
- Responsive 3-column grid on desktop, stacks on mobile
- Toast notifications for user feedback
- Modal with 3-column layout: Basic Info (2 cols) + Preview (1 col)
- Clean table interface for discount matrix management

### 2. **Page Integration**
Updated: `src/app/(dashboard)/admin/pricing/page.tsx`

**Changes:**
- Added new "Tiers" tab to the Pricing Management tabs
- Integrated `TierManagement` component conditionally rendered for the Tiers tab
- Updated TypeScript types to include 'tiers' in `TabKey`
- Added column configuration for consistency

### 3. **API Routes**
Updated: 
- `src/app/api/admin/pricing/client-tiers/route.ts` (GET/POST)
- `src/app/api/admin/pricing/client-tiers/[id]/route.ts` (GET/PUT/DELETE)

**Features:**
- ✅ **Double-cast pattern:** Uses `data.discountMatrix as unknown as Prisma.InputJsonValue`
- ✅ **JSON handling:** Proper Prisma typing for JSON fields
- ✅ **NO array spread:** Uses `Array.from()` for category lists
- Backward compatible: `discountMatrix` is optional, existing tiers work without it
- Soft delete: DELETE endpoint sets `isActive: false` instead of hard deletion

### 4. **Database Schema**
Updated: `prisma/schema.prisma`

```prisma
model ClientTier {
  // ... existing fields
  discountMatrix Json?    @map("discount_matrix")
  // ... rest of model
}
```

**Migration Created:**
`prisma/migrations/20260204000000_add_discount_matrix_to_client_tiers/migration.sql`

```sql
ALTER TABLE "client_tiers" ADD COLUMN "discount_matrix" JSONB;
```

## Discount Matrix Data Structure

```typescript
interface DiscountMatrix {
  globalDiscount: number;           // e.g., 10 (for 10%)
  categoryDiscounts: DiscountRow[];
}

interface DiscountRow {
  category: 'slabs' | 'cutting' | 'polishing' | 'cutouts' | 'delivery' | 'installation';
  discountPercent: number;          // e.g., 5 (for 5%)
  isExcluded: boolean;              // If true, global discount doesn't apply
}
```

**Example JSON in database:**
```json
{
  "globalDiscount": 10,
  "categoryDiscounts": [
    { "category": "slabs", "discountPercent": 5, "isExcluded": false },
    { "category": "cutting", "discountPercent": 0, "isExcluded": false },
    { "category": "polishing", "discountPercent": 0, "isExcluded": false },
    { "category": "cutouts", "discountPercent": 3, "isExcluded": true },
    { "category": "delivery", "discountPercent": 0, "isExcluded": false },
    { "category": "installation", "discountPercent": 8, "isExcluded": false }
  ]
}
```

## Discount Logic

### Calculation Rules:
1. **Non-Excluded Categories:** Apply BOTH global + category-specific discount
   - Example: 10% global + 5% category = 15% total discount
   
2. **Excluded Categories:** Apply ONLY category-specific discount
   - Example: Category marked excluded with 3% = 3% discount (ignores global 10%)

### Preview Calculator:
- Enter a test amount (e.g., $1000)
- See breakdown per category:
  - Original amount (equal split across 6 categories)
  - Discount applied
  - Final amount
- Shows total discount and final price

**Example Calculation (for $1000 total):**
- Each category gets: $1000 ÷ 6 = $166.67
- Slabs (not excluded): $166.67 - 15% (10% global + 5% category) = $141.67
- Cutouts (excluded): $166.67 - 3% (category only) = $161.67
- Final Total: Sum of all 6 categories after discounts

## Critical Lessons Applied

✅ **Proper JSON Handling:**
```typescript
let discountMatrixData: Prisma.InputJsonValue | undefined;
if (data.discountMatrix) {
  discountMatrixData = data.discountMatrix as unknown as Prisma.InputJsonValue;
}
```

✅ **No Array Spread Syntax:**
```typescript
// Used Array.from() for unique category lists
const categories = Array.from(DISCOUNT_CATEGORIES).map(cat => cat.id);
```

✅ **Linear Design System:**
- Zinc-50 background panels
- Amber-600 primary buttons
- Amber-500 focus rings
- Clean spacing and typography

## How to Use

### For Admins:
1. Navigate to **Admin → Pricing Management**
2. Click the **"Tiers"** tab
3. Click **"Create Tier"** button
4. Fill in tier details:
   - Name (e.g., "Gold Trade")
   - Description (optional)
   - Priority (higher = better pricing)
5. Set **Global Across-the-Board Discount** (e.g., 10%)
6. Configure each category:
   - Set category-specific discount %
   - Check "Excluded from Global?" to apply only category discount
7. Use **Preview Calculator** to test pricing
8. Click **"Save Tier"**

### For Developers:
When implementing pricing logic elsewhere, fetch the tier's `discountMatrix`:

```typescript
const tier = await prisma.clientTier.findUnique({
  where: { id: tierId }
});

if (tier.discountMatrix) {
  const matrix = tier.discountMatrix as {
    globalDiscount: number;
    categoryDiscounts: Array<{
      category: string;
      discountPercent: number;
      isExcluded: boolean;
    }>;
  };
  
  // Apply discount logic
  const categoryRule = matrix.categoryDiscounts.find(
    c => c.category === 'slabs'
  );
  
  let discount = 0;
  if (categoryRule.isExcluded) {
    discount = categoryRule.discountPercent;
  } else {
    discount = matrix.globalDiscount + categoryRule.discountPercent;
  }
}
```

## Migration Instructions

### Local Development:
```bash
# Generate Prisma client
npx prisma generate

# Apply migration (if DB accessible)
npx prisma migrate deploy
```

### Railway/Production:
The migration will auto-apply on next deployment via Railway's build process.

**Manual application (if needed):**
```bash
# Via Railway CLI
railway run npx prisma migrate deploy

# Or via Railway dashboard
# Add to build command: npm run build && npx prisma migrate deploy
```

## Testing Checklist

- [x] Create new tier with discount matrix
- [x] Edit existing tier
- [x] Preview calculator shows correct calculations
- [x] Global discount applies to non-excluded categories
- [x] Excluded categories ignore global discount
- [x] Category-specific discounts stack with global (when not excluded)
- [x] Toast notifications work
- [x] Modal opens/closes correctly
- [x] Responsive design works on mobile
- [x] No TypeScript errors
- [x] No linting errors
- [x] API routes handle JSON properly

## Next Steps

### Integration with Quote Calculator:
When you're ready to apply these discounts to actual quotes:

1. Fetch customer's assigned tier
2. Retrieve the `discountMatrix`
3. Apply discounts to quote line items based on category
4. Show discount breakdown in quote summary

### Potential Enhancements:
- Date range for seasonal discounts
- Minimum/maximum order thresholds
- Material-specific overrides within categories
- Export/import tier configurations
- Tier comparison view
- Audit log for discount changes

## Files Created/Modified

### Created:
- `src/components/pricing/TierManagement.tsx` (565 lines)
- `prisma/migrations/20260204000000_add_discount_matrix_to_client_tiers/migration.sql`

### Modified:
- `src/app/(dashboard)/admin/pricing/page.tsx` (+4 lines, updated tabs)
- `src/app/api/admin/pricing/client-tiers/route.ts` (+10 lines, JSON handling)
- `src/app/api/admin/pricing/client-tiers/[id]/route.ts` (+13 lines, JSON handling)
- `prisma/schema.prisma` (+3 lines, added discountMatrix field)

## Technical Notes

### Why JSON for Discount Matrix?
- **Flexibility:** Easy to add new categories without schema changes
- **Performance:** Single field reduces JOIN complexity
- **Simplicity:** Self-contained discount rules per tier
- **Type Safety:** TypeScript interfaces enforce structure on client

### Why Separate from PricingRule?
- **Scope:** PricingRule is for complex conditional pricing across customers
- **Simplicity:** Discount Matrix is simpler, tier-specific configuration
- **UI:** Easier to present in a table format
- **Performance:** Direct lookup without rule matching logic

---

**Implementation Time:** ~2 hours  
**Complexity:** Medium  
**Status:** ✅ Production Ready  
**Testing Required:** User acceptance testing recommended
