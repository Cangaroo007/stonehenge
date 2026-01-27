/**
 * Slab Optimization Types
 * Used by the bin-packing algorithm and API endpoints
 */

export interface Placement {
  pieceId: string;
  slabIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  label: string;
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

export interface OptimizationResult {
  placements: Placement[];
  slabs: SlabResult[];
  totalSlabs: number;
  totalUsedArea: number;
  totalWasteArea: number;
  wastePercent: number;
  unplacedPieces: string[];
}

export interface OptimizationInput {
  pieces: Array<{
    id: string;
    width: number;
    height: number;
    label: string;
    canRotate?: boolean;
  }>;
  slabWidth: number;
  slabHeight: number;
  kerfWidth: number;
  allowRotation: boolean;
}

// Re-export for convenience
export type { Placement as SlabPlacement };
