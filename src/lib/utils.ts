import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (num === null || num === undefined || isNaN(num)) return '$0.00';
  
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(num);
}

export function formatNumber(num: number | string | null | undefined, decimals = 2): string {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (n === null || n === undefined || isNaN(n)) return '0';
  return n.toFixed(decimals);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function calculateArea(lengthMm: number, widthMm: number): number {
  return (lengthMm * widthMm) / 1000000; // Convert mm² to m²
}

export function generateQuoteNumber(lastNumber: string | null): string {
  const prefix = 'Q-';
  if (!lastNumber) {
    return `${prefix}00001`;
  }
  
  const numPart = lastNumber.replace(prefix, '');
  const nextNum = parseInt(numPart, 10) + 1;
  return `${prefix}${nextNum.toString().padStart(5, '0')}`;
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'draft':
      return 'bg-gray-100 text-gray-800';
    case 'sent':
      return 'bg-blue-100 text-blue-800';
    case 'accepted':
      return 'bg-green-100 text-green-800';
    case 'declined':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Stone Slab Calculator Types
export interface SlabDimensions {
  lengthMm: number;
  widthMm: number;
}

export interface ProjectPiece {
  lengthMm: number;
  widthMm: number;
  quantity?: number;
}

export interface SlabCalculationResult {
  slabsRequired: number;
  totalPieceArea: number;
  slabArea: number;
  totalSlabArea: number;
  utilizationPercentage: number;
  wastePercentage: number;
}

export interface DetailedSlabCalculationResult extends SlabCalculationResult {
  piecesFitOnSlab: boolean;
  oversizedPieces: ProjectPiece[];
}

/**
 * Calculate the area of a single slab in square meters
 */
export const calculateSlabArea = (slab: SlabDimensions): number => {
  return (slab.lengthMm * slab.widthMm) / 1_000_000;
};

/**
 * Calculate total area required for all project pieces in square meters
 */
export const calculateTotalPieceArea = (pieces: ProjectPiece[]): number => {
  return pieces.reduce((total, piece) => {
    const quantity = piece.quantity ?? 1;
    const area = (piece.lengthMm * piece.widthMm) / 1_000_000;
    return total + area * quantity;
  }, 0);
};

/**
 * Simple slab calculation based on area with waste factor
 *
 * @param pieces - Array of project pieces with dimensions
 * @param slabDimensions - Dimensions of the stone slab
 * @param wasteFactor - Expected waste percentage (0-1), default 0.15 (15%)
 * @returns Calculation result with slabs required and utilization stats
 */
export const calculateSlabsRequired = (
  pieces: ProjectPiece[],
  slabDimensions: SlabDimensions,
  wasteFactor: number = 0.15
): SlabCalculationResult => {
  const totalPieceArea = calculateTotalPieceArea(pieces);
  const slabArea = calculateSlabArea(slabDimensions);

  // Account for waste by reducing usable area per slab
  const usableAreaPerSlab = slabArea * (1 - wasteFactor);

  // Calculate slabs needed (always round up - can't buy partial slabs)
  const slabsRequired = Math.ceil(totalPieceArea / usableAreaPerSlab);

  const totalSlabArea = slabsRequired * slabArea;
  const utilizationPercentage = (totalPieceArea / totalSlabArea) * 100;
  const wastePercentage = 100 - utilizationPercentage;

  return {
    slabsRequired,
    totalPieceArea,
    slabArea,
    totalSlabArea,
    utilizationPercentage,
    wastePercentage,
  };
};

/**
 * Check if a piece can physically fit on a slab (in either orientation)
 */
export const canPieceFitOnSlab = (
  piece: ProjectPiece,
  slab: SlabDimensions
): boolean => {
  // Check normal orientation
  const fitsNormal = piece.lengthMm <= slab.lengthMm && piece.widthMm <= slab.widthMm;
  // Check rotated 90 degrees
  const fitsRotated = piece.lengthMm <= slab.widthMm && piece.widthMm <= slab.lengthMm;

  return fitsNormal || fitsRotated;
};

/**
 * Detailed slab calculation that also checks if pieces fit within slab dimensions
 *
 * @param pieces - Array of project pieces with dimensions
 * @param slabDimensions - Dimensions of the stone slab
 * @param wasteFactor - Expected waste percentage (0-1), default 0.15 (15%)
 * @returns Detailed calculation result including fit validation
 */
export const calculateSlabsRequiredDetailed = (
  pieces: ProjectPiece[],
  slabDimensions: SlabDimensions,
  wasteFactor: number = 0.15
): DetailedSlabCalculationResult => {
  const baseResult = calculateSlabsRequired(pieces, slabDimensions, wasteFactor);

  // Find any pieces that don't fit on the slab
  const oversizedPieces = pieces.filter(
    (piece) => !canPieceFitOnSlab(piece, slabDimensions)
  );

  return {
    ...baseResult,
    piecesFitOnSlab: oversizedPieces.length === 0,
    oversizedPieces,
  };
};

/**
 * Common stone slab sizes in mm (for reference/defaults)
 */
export const COMMON_SLAB_SIZES: Record<string, SlabDimensions> = {
  'standard': { lengthMm: 3000, widthMm: 1400 },
  'jumbo': { lengthMm: 3200, widthMm: 1600 },
  'compact': { lengthMm: 2400, widthMm: 1200 },
};
