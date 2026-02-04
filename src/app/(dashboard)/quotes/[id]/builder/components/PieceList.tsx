'use client';

import { useMemo } from 'react';
import { useUnits } from '@/lib/contexts/UnitContext';
import { getDimensionUnitLabel, mmToDisplayUnit } from '@/lib/utils/units';
import { formatCurrency } from '@/lib/utils';
import type { CalculationResult } from '@/lib/types/pricing';

interface MachineOption {
  id: string;
  name: string;
  kerfWidthMm: number;
  isDefault: boolean;
}

interface EdgeType {
  id: string;
  name: string;
  description: string | null;
  category: string;
  baseRate: number;
  isActive: boolean;
  sortOrder: number;
}

interface QuotePiece {
  id: number;
  name: string;
  description: string | null;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  materialName: string | null;
  edgeTop: string | null;
  edgeBottom: string | null;
  edgeLeft: string | null;
  edgeRight: string | null;
  machineProfileId: string | null;
  sortOrder: number;
  totalCost: number;
  room: {
    id: number;
    name: string;
  };
}

interface PieceListProps {
  pieces: QuotePiece[];
  selectedPieceId: number | null;
  onSelectPiece: (pieceId: number) => void;
  onDeletePiece: (pieceId: number) => void;
  onDuplicatePiece: (pieceId: number) => void;
  onReorder: (pieces: { id: number; sortOrder: number }[]) => void;
  machines?: MachineOption[];
  defaultMachineId?: string | null;
  calculation?: CalculationResult | null;
  discountDisplayMode?: 'ITEMIZED' | 'TOTAL_ONLY';
  edgeTypes?: EdgeType[];
}

// Get edge summary string for a piece
const getEdgeSummary = (piece: QuotePiece): string => {
  const edges = [
    piece.edgeTop && `T`,
    piece.edgeBottom && `B`,
    piece.edgeLeft && `L`,
    piece.edgeRight && `R`,
  ].filter(Boolean);

  return edges.length > 0 ? edges.join(', ') : '';
};

// Check if piece has any edges
const hasEdges = (piece: QuotePiece): boolean => {
  return !!(piece.edgeTop || piece.edgeBottom || piece.edgeLeft || piece.edgeRight);
};

// Check if piece has 40mm edges that need lamination
const has40mmEdges = (piece: QuotePiece): boolean => {
  return piece.thicknessMm >= 40 && hasEdges(piece);
};

// Count how many edges have 40mm profiles
const count40mmEdges = (piece: QuotePiece): number => {
  if (piece.thicknessMm < 40) return 0;

  let count = 0;
  if (piece.edgeTop) count++;
  if (piece.edgeBottom) count++;
  if (piece.edgeLeft) count++;
  if (piece.edgeRight) count++;
  return count;
};

// Check if any edge is a 40mm Mitre type
const hasMitreEdge = (piece: QuotePiece, edgeTypes: EdgeType[]): boolean => {
  const edgeIds = [piece.edgeTop, piece.edgeBottom, piece.edgeLeft, piece.edgeRight].filter(Boolean);
  return edgeIds.some(id => {
    const et = edgeTypes.find(e => e.id === id);
    return et && et.name.toLowerCase().includes('mitre');
  });
};

// Compute per-piece pricing breakdown
interface PiecePricing {
  basePrice: number;
  tierDiscount: number;
  machineMargin: number;
  finalCost: number;
}

function computePiecePricing(
  piece: QuotePiece,
  pieceCount: number,
  calculation: CalculationResult | null,
  machineKerf: number,
): PiecePricing {
  // Base price: proportional share from calculation materials subtotal
  const pieceArea = (piece.lengthMm * piece.widthMm) / 1_000_000;
  let basePrice = piece.totalCost || 0;

  if (calculation?.breakdown?.materials) {
    const totalArea = Number(calculation.breakdown.materials.totalAreaM2) || 1;
    const materialSubtotal = calculation.breakdown.materials.subtotal || 0;
    // Proportional share of material cost based on area
    basePrice = (pieceArea / totalArea) * materialSubtotal;
  }

  // Tier discount: proportional share of total discount based on piece count
  let tierDiscount = 0;
  if (calculation?.discounts && calculation.discounts.length > 0) {
    const totalSavings = calculation.discounts.reduce((sum, d) => sum + d.savings, 0);
    tierDiscount = pieceCount > 0 ? totalSavings / pieceCount : 0;
  }

  // Machine margin: additional material consumed by kerf (approximate)
  // Each cut consumes kerfWidth mm of additional material along the longest dimension
  const kerfAreaM2 = ((piece.lengthMm + piece.widthMm) * machineKerf) / 1_000_000;
  const materialRate = calculation?.breakdown?.materials
    ? (calculation.breakdown.materials.subtotal / (Number(calculation.breakdown.materials.totalAreaM2) || 1))
    : 0;
  const machineMargin = kerfAreaM2 * materialRate;

  const finalCost = basePrice - tierDiscount + machineMargin;

  return { basePrice, tierDiscount, machineMargin, finalCost };
}

export default function PieceList({
  pieces,
  selectedPieceId,
  onSelectPiece,
  onDeletePiece,
  onDuplicatePiece,
  onReorder,
  machines = [],
  defaultMachineId,
  calculation = null,
  discountDisplayMode = 'ITEMIZED',
  edgeTypes = [],
}: PieceListProps) {
  const { unitSystem } = useUnits();
  const unitLabel = getDimensionUnitLabel(unitSystem);

  // Resolve machine name and kerf for a piece
  const getMachineInfo = (piece: QuotePiece): { name: string; kerf: number } => {
    if (piece.machineProfileId) {
      const machine = machines.find(m => m.id === piece.machineProfileId);
      if (machine) return { name: machine.name, kerf: machine.kerfWidthMm };
    }
    const defaultMachine = machines.find(m => m.id === defaultMachineId);
    if (defaultMachine) return { name: defaultMachine.name, kerf: defaultMachine.kerfWidthMm };
    return { name: 'GMM Bridge Saw', kerf: 8 };
  };

  // Pre-compute pricing for all pieces
  const piecePricingMap = useMemo(() => {
    const map = new Map<number, PiecePricing>();
    for (const piece of pieces) {
      const machineInfo = getMachineInfo(piece);
      map.set(piece.id, computePiecePricing(piece, pieces.length, calculation, machineInfo.kerf));
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieces, calculation, machines, defaultMachineId]);

  // Resolve edge type name from ID
  const getEdgeTypeName = (edgeTypeId: string | null): string | null => {
    if (!edgeTypeId) return null;
    const et = edgeTypes.find(e => e.id === edgeTypeId);
    return et?.name ?? null;
  };

  // Get mitre strip info for a piece
  const getMitreStripInfo = (piece: QuotePiece): { count: number; formula: string } | null => {
    if (piece.thicknessMm < 40) return null;
    const machineInfo = getMachineInfo(piece);
    const edgeIds = [
      { id: piece.edgeTop, side: 'T' },
      { id: piece.edgeBottom, side: 'B' },
      { id: piece.edgeLeft, side: 'L' },
      { id: piece.edgeRight, side: 'R' },
    ];
    let mitreCount = 0;
    for (const edge of edgeIds) {
      if (!edge.id) continue;
      const name = getEdgeTypeName(edge.id);
      if (name && name.toLowerCase().includes('mitre')) {
        mitreCount++;
      }
    }
    if (mitreCount === 0) return null;
    const stripWidth = piece.thicknessMm + machineInfo.kerf + 5;
    return {
      count: mitreCount,
      formula: `${piece.thicknessMm}+${machineInfo.kerf}+5=${stripWidth}mm`,
    };
  };

  const handleMoveUp = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index === 0) return;

    const currentPiece = pieces[index];
    const prevPiece = pieces[index - 1];

    const reorderedPieces = [
      { id: currentPiece.id, sortOrder: prevPiece.sortOrder },
      { id: prevPiece.id, sortOrder: currentPiece.sortOrder },
    ];

    onReorder(reorderedPieces);
  };

  const handleMoveDown = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index === pieces.length - 1) return;

    const currentPiece = pieces[index];
    const nextPiece = pieces[index + 1];

    const reorderedPieces = [
      { id: currentPiece.id, sortOrder: nextPiece.sortOrder },
      { id: nextPiece.id, sortOrder: currentPiece.sortOrder },
    ];

    onReorder(reorderedPieces);
  };

  const handleDelete = (pieceId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeletePiece(pieceId);
  };

  const handleDuplicate = (pieceId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicatePiece(pieceId);
  };

  if (pieces.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <svg
          className="mx-auto h-12 w-12 text-gray-400 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <p className="mb-2">No pieces added yet</p>
        <p className="text-sm">Click &quot;Add Piece&quot; to start building your quote</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Dimensions
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Machine
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Room
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Edges
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pricing
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {pieces.map((piece, index) => {
            const machineInfo = getMachineInfo(piece);
            const pricing = piecePricingMap.get(piece.id);
            const mitreInfo = getMitreStripInfo(piece);
            return (
              <tr
                key={piece.id}
                onClick={() => onSelectPiece(piece.id)}
                className={`cursor-pointer transition-colors ${
                  selectedPieceId === piece.id
                    ? 'bg-primary-50 ring-2 ring-inset ring-primary-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                    selectedPieceId === piece.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {index + 1}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{piece.name}</div>
                  {piece.materialName && (
                    <div className="text-xs text-gray-500">{piece.materialName}</div>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                  <div>
                    {Math.round(mmToDisplayUnit(piece.lengthMm, unitSystem))} {'\u00D7'} {Math.round(mmToDisplayUnit(piece.widthMm, unitSystem))}{unitLabel}
                  </div>
                  <div className="text-xs text-gray-400">
                    {Math.round(mmToDisplayUnit(piece.thicknessMm, unitSystem))}{unitLabel} thick
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <div className="text-gray-700 text-xs font-medium">{machineInfo.name}</div>
                  <div className="text-gray-400 text-xs">{machineInfo.kerf}mm kerf</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                    {piece.room.name}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  {hasEdges(piece) ? (
                    <div className="space-y-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        {getEdgeSummary(piece)}
                      </span>
                      {has40mmEdges(piece) && (
                        <div className="flex items-center gap-1 text-xs text-amber-600">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <span className="font-medium">
                            {count40mmEdges(piece)} Strip{count40mmEdges(piece) !== 1 ? 's' : ''} ({machineInfo.kerf}mm kerf)
                          </span>
                        </div>
                      )}
                      {mitreInfo && (
                        <div className="flex items-center gap-1 text-xs text-purple-600">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="font-medium">
                            {mitreInfo.count} Mitre Strip{mitreInfo.count !== 1 ? 's' : ''} ({mitreInfo.formula})
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">None</span>
                  )}
                </td>
                {/* Itemized Pricing Column */}
                <td className="px-4 py-3 text-sm text-right">
                  {pricing ? (
                    <div className="space-y-0.5">
                      <div className="text-xs text-gray-500">
                        Base: {formatCurrency(pricing.basePrice)}
                      </div>
                      {discountDisplayMode === 'ITEMIZED' && (
                        <div className={`text-xs ${pricing.tierDiscount > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          Disc: {pricing.tierDiscount > 0 ? '-' : ''}{formatCurrency(pricing.tierDiscount)}
                        </div>
                      )}
                      {pricing.machineMargin > 0.01 && (
                        <div className="text-xs text-amber-600">
                          Mach: +{formatCurrency(pricing.machineMargin)}
                        </div>
                      )}
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(pricing.finalCost)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-1">
                    {/* Move Up */}
                    <button
                      onClick={(e) => handleMoveUp(index, e)}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    {/* Move Down */}
                    <button
                      onClick={(e) => handleMoveDown(index, e)}
                      disabled={index === pieces.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {/* Duplicate */}
                    <button
                      onClick={(e) => handleDuplicate(piece.id, e)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Duplicate piece"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                    {/* Delete */}
                    <button
                      onClick={(e) => handleDelete(piece.id, e)}
                      className="p-1 text-red-400 hover:text-red-600"
                      title="Delete piece"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
