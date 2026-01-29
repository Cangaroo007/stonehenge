/**
 * Slab Optimization Types
 * Used by the bin-packing algorithm and API endpoints
 */

// NEW: Which edges are finished (polished) - needed for 40mm+ lamination
export interface FinishedEdges {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export interface Placement {
  pieceId: string;
  slabIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  label: string;
  // NEW: Lamination tracking
  isLaminationStrip?: boolean;
  parentPieceId?: string;
  stripPosition?: 'top' | 'bottom' | 'left' | 'right';
}

export interface SlabResult {
  slabIndex: number;
  width: number;
  height: number;
  placements: Placement[];
  usedArea: number;
  wasteArea: number;
  wastePercent: number;
}

// NEW: Lamination summary for reporting
export interface LaminationSummary {
  totalStrips: number;
  totalStripArea: number; // m²
  stripsByParent: Array<{
    parentPieceId: string;
    parentLabel: string;
    strips: Array<{
      position: string;
      lengthMm: number;
      widthMm: number;
    }>;
  }>;
}

export interface OptimizationResult {
  placements: Placement[];
  slabs: SlabResult[];
  totalSlabs: number;
  totalUsedArea: number;
  totalWasteArea: number;
  wastePercent: number;
  unplacedPieces: string[];
  // NEW: Lamination summary
  laminationSummary?: LaminationSummary;
}

export interface OptimizationInput {
  pieces: Array<{
    id: string;
    width: number;
    height: number;
    label: string;
    canRotate?: boolean;
    // NEW: Thickness tracking (20mm, 40mm, 60mm, etc.)
    thickness?: number;
    // NEW: Which edges need lamination strips
    finishedEdges?: FinishedEdges;
  }>;
  slabWidth: number;
  slabHeight: number;
  kerfWidth: number;
  allowRotation: boolean;
}

// Re-export for convenience
export type { Placement as SlabPlacement };
