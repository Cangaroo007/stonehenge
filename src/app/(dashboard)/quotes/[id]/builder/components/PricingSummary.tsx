'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatCurrency } from '@/lib/utils';
import { useUnits } from '@/lib/contexts/UnitContext';
import { formatAreaFromSqm } from '@/lib/utils/units';
import { debounce } from '@/lib/utils/debounce';
import type { CalculationResult } from '@/lib/types/pricing';
import PieceBreakdownDisplay from './PieceBreakdownDisplay';
import MaterialsBreakdown from './MaterialsBreakdown';
import AdditionalCharges from './AdditionalCharges';
import QuoteTotals from './QuoteTotals';

// GST rate (configurable, default 10% for Australia)
const GST_RATE = 0.10;

interface PricingSummaryProps {
  quoteId: string;
  refreshTrigger: number;
  customerName?: string | null;
  customerTier?: string | null;
  customerType?: string | null;
  priceBookName?: string | null;
  onCalculationComplete?: (result: CalculationResult | null) => void;
}

interface QuotePiece {
  id: number;
  name: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  edgeTop: string | null;
  edgeBottom: string | null;
  edgeLeft: string | null;
  edgeRight: string | null;
  cutouts: Array<{ cutoutTypeId: string; cutoutTypeName: string; quantity: number }>;
}

export default function PricingSummary({
  quoteId,
  refreshTrigger,
  customerName,
  customerTier,
  customerType,
  priceBookName,
  onCalculationComplete,
}: PricingSummaryProps) {
  const { unitSystem } = useUnits();
  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [pieces, setPieces] = useState<QuotePiece[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [additionalDiscount, setAdditionalDiscount] = useState<{ type: 'percentage' | 'fixed'; value: number }>({
    type: 'percentage',
    value: 0
  });

  // Fetch pieces data
  const fetchPieces = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotes/${quoteId}`);
      if (!res.ok) throw new Error('Failed to fetch quote');
      const data = await res.json();
      const allPieces = data.rooms?.flatMap((room: any) => 
        room.pieces.map((piece: any) => ({
          ...piece,
          cutouts: Array.isArray(piece.cutouts) ? piece.cutouts : []
        }))
      ) || [];
      setPieces(allPieces);
    } catch (err) {
      console.error('Failed to fetch pieces:', err);
    }
  }, [quoteId]);

  // Debounced calculation function
  const performCalculation = useCallback(async () => {
    setIsCalculating(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to calculate');
      }

      const data = await res.json();
      setCalculation(data);
      // Notify parent of calculation result
      if (onCalculationComplete) {
        onCalculationComplete(data);
      }
      
      // Fetch pieces data after calculation
      await fetchPieces();
    } catch (err) {
      console.error('Calculation failed:', err);
      setError(err instanceof Error ? err.message : 'Calculation failed');
      // Notify parent of null calculation on error
      if (onCalculationComplete) {
        onCalculationComplete(null);
      }
    } finally {
      setIsCalculating(false);
    }
  }, [quoteId, onCalculationComplete, fetchPieces]);

  // Create debounced version with useMemo
  const debouncedCalculate = useMemo(
    () => debounce(performCalculation, 500),
    [performCalculation]
  );

  // Trigger calculation when refreshTrigger changes
  useEffect(() => {
    debouncedCalculate();
  }, [refreshTrigger, debouncedCalculate]);

  // Calculate per-piece breakdowns
  const pieceBreakdowns = useMemo(() => {
    if (!calculation || !pieces.length) return [];

    return pieces.map((piece, index) => {
      const items = [];
      const perimeter = 2 * (piece.lengthMm + piece.widthMm) / 1000; // in metres
      
      // Cutting (approximation - would need actual edge count)
      const edgeCount = [piece.edgeTop, piece.edgeBottom, piece.edgeLeft, piece.edgeRight].filter(Boolean).length;
      if (edgeCount > 0 && calculation.breakdown.edges) {
        // Distribute cutting cost proportionally
        const cuttingLm = perimeter;
        const avgEdgeRate = calculation.breakdown.edges.subtotal / (calculation.breakdown.edges.totalLinearMeters || 1);
        const cuttingBase = cuttingLm * avgEdgeRate;
        const cuttingDiscount = (calculation.breakdown.edges.discount / (calculation.breakdown.edges.totalLinearMeters || 1)) * cuttingLm;
        items.push({
          label: 'Cutting',
          quantity: cuttingLm,
          unit: 'Lm',
          rate: avgEdgeRate,
          base: cuttingBase,
          discount: cuttingDiscount,
          total: cuttingBase - cuttingDiscount
        });

        // Polishing (same as cutting for now)
        items.push({
          label: 'Polishing',
          quantity: cuttingLm,
          unit: 'Lm',
          rate: avgEdgeRate,
          base: cuttingBase,
          discount: cuttingDiscount,
          total: cuttingBase - cuttingDiscount
        });
      }

      // Edge profiles
      calculation.breakdown.edges.byType.forEach(edge => {
        items.push({
          label: `Edge (${edge.edgeTypeName})`,
          quantity: edge.linearMeters / pieces.length, // Rough approximation
          unit: 'Lm',
          rate: edge.appliedRate,
          base: edge.subtotal / pieces.length,
          discount: 0,
          total: edge.subtotal / pieces.length
        });
      });

      // Cutouts for this piece
      piece.cutouts.forEach(cutout => {
        const cutoutData = calculation.breakdown.cutouts.items.find(c => c.cutoutTypeId === cutout.cutoutTypeId);
        if (cutoutData) {
          items.push({
            label: `Cutout (${cutout.cutoutTypeName})`,
            quantity: cutout.quantity,
            unit: '×',
            rate: cutoutData.appliedPrice,
            base: cutout.quantity * cutoutData.appliedPrice,
            discount: 0,
            total: cutout.quantity * cutoutData.appliedPrice
          });
        }
      });

      const subtotal = items.reduce((sum, item) => sum + item.total, 0);

      return {
        index: index + 1,
        piece,
        items,
        subtotal
      };
    });
  }, [calculation, pieces]);

  // Calculate totals
  const fabricationTotal = pieceBreakdowns.reduce((sum, pb) => sum + pb.subtotal, 0);
  const materialsTotal = calculation?.breakdown.materials?.total ?? 0;
  const additionalTotal = 
    (calculation?.breakdown.delivery?.finalCost ?? 0) +
    (calculation?.breakdown.templating?.finalCost ?? 0);
  
  const baseSubtotal = fabricationTotal + materialsTotal + additionalTotal;
  
  // Apply additional discount
  const discountAmount = additionalDiscount.type === 'percentage'
    ? baseSubtotal * (additionalDiscount.value / 100)
    : additionalDiscount.value;
  const subtotalAfterDiscount = baseSubtotal - discountAmount;
  
  // Calculate GST
  const gst = subtotalAfterDiscount * GST_RATE;
  const grandTotal = subtotalAfterDiscount + gst;

  // Calculate total savings
  const totalSavings = calculation?.discounts.reduce((sum, d) => sum + d.savings, 0) ?? 0;

  // Retry handler
  const handleRetry = () => {
    performCalculation();
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-lg font-semibold hover:text-primary-600 transition-colors"
        >
          <svg
            className={`h-5 w-5 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          PRICING
        </button>
        <button
          onClick={handleRetry}
          disabled={isCalculating}
          className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50 flex items-center gap-1"
        >
          {isCalculating ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Calculating...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Recalculate 🔄
            </>
          )}
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className={`p-4 space-y-4 ${isCalculating ? 'opacity-60' : ''}`}>
          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              <p className="font-medium">Calculation Error</p>
              <p>{error}</p>
              <button
                onClick={handleRetry}
                className="mt-2 text-red-800 underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* Warning when no customer selected */}
          {!customerName && (
            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-gray-600 text-sm">
                    No customer selected
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    Using standard base prices. Select a customer to apply their pricing tier.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Customer Info with Tier Badge */}
          {customerName && (
            <div className="pb-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">
                    <span className="text-gray-600">Customer:</span>{' '}
                    <span className="font-medium">{customerName}</span>
                  </p>
                  {customerType && (
                    <p className="text-xs text-gray-500 mt-0.5">{customerType}</p>
                  )}
                </div>
                {customerTier && (
                  <span className={`
                    inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${customerTier === 'Tier 1' ? 'bg-green-100 text-green-800' :
                      customerTier === 'Tier 2' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'}
                  `}>
                    {customerTier}
                  </span>
                )}
              </div>
              {priceBookName && (
                <p className="text-sm mt-1">
                  <span className="text-gray-600">Price Book:</span>{' '}
                  <span className="font-medium">{priceBookName}</span>
                </p>
              )}
            </div>
          )}

          {/* Main Content */}
          {calculation && pieces.length > 0 ? (
            <>
              {/* Piece Breakdown Section */}
              <div className="pb-3 border-b-2 border-gray-300">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">PIECE BREAKDOWN</h4>
                {pieceBreakdowns.map((pb) => (
                  <PieceBreakdownDisplay
                    key={pb.index}
                    index={pb.index}
                    piece={pb.piece}
                    items={pb.items}
                    subtotal={pb.subtotal}
                  />
                ))}
              </div>

              {/* Materials Section */}
              <MaterialsBreakdown
                total={materialsTotal}
              />

              {/* Additional Charges Section */}
              {additionalTotal > 0 && (
                <AdditionalCharges
                  delivery={calculation.breakdown.delivery ? {
                    zone: calculation.breakdown.delivery.zone || undefined,
                    price: calculation.breakdown.delivery.finalCost
                  } : undefined}
                  templating={calculation.breakdown.templating?.finalCost ? {
                    price: calculation.breakdown.templating.finalCost
                  } : undefined}
                  total={additionalTotal}
                />
              )}

              {/* Totals Section */}
              <QuoteTotals
                fabricationTotal={fabricationTotal}
                materialsTotal={materialsTotal}
                additionalTotal={additionalTotal}
                subtotal={baseSubtotal}
                additionalDiscount={additionalDiscount}
                onDiscountChange={setAdditionalDiscount}
                subtotalAfterDiscount={subtotalAfterDiscount}
                gst={gst}
                total={grandTotal}
              />
            </>
          ) : isCalculating ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No pricing data available.</p>
              <button
                onClick={handleRetry}
                className="mt-2 text-primary-600 hover:text-primary-700 underline"
              >
                Calculate Now
              </button>
            </div>
          )}

          {/* Calculated At Timestamp */}
          {calculation?.calculatedAt && (
            <p className="text-xs text-gray-400 text-right pt-2">
              Last calculated: {new Date(calculation.calculatedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
