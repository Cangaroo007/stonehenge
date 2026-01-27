import { OptimizationResult } from '@/types/slab-optimization';

export interface CutListData {
  summary: {
    totalSlabs: number;
    totalPieces: number;
    totalArea: number;
    wastePercent: number;
    generatedAt: Date;
  };
  slabs: Array<{
    slabNumber: number;
    dimensions: string;
    pieceCount: number;
    wastePercent: number;
    pieces: Array<{
      label: string;
      width: number;
      height: number;
      x: number;
      y: number;
      rotated: boolean;
    }>;
  }>;
}

/**
 * Generate CSV string from optimization result
 */
export function generateCutListCSV(
  result: OptimizationResult,
  slabWidth: number,
  slabHeight: number
): string {
  const headers = [
    'Slab #',
    'Piece Label',
    'Width (mm)',
    'Height (mm)',
    'X Position',
    'Y Position',
    'Rotated',
  ];

  const rows = result.placements.map(p => [
    p.slabIndex + 1,
    `"${p.label.replace(/"/g, '""')}"`,
    p.width,
    p.height,
    p.x,
    p.y,
    p.rotated ? 'Yes' : 'No',
  ]);

  // Add summary rows
  const summaryRows = [
    [],
    ['Summary'],
    ['Total Slabs', result.totalSlabs],
    ['Total Pieces', result.placements.length],
    ['Slab Size', `${slabWidth} x ${slabHeight} mm`],
    ['Waste %', `${result.wastePercent.toFixed(1)}%`],
    ['Generated', new Date().toISOString()],
  ];

  return [
    headers.join(','),
    ...rows.map(row => row.join(',')),
    ...summaryRows.map(row => row.join(',')),
  ].join('\n');
}

/**
 * Generate structured data for PDF/display
 */
export function generateCutListData(
  result: OptimizationResult,
  slabWidth: number,
  slabHeight: number
): CutListData {
  return {
    summary: {
      totalSlabs: result.totalSlabs,
      totalPieces: result.placements.length,
      totalArea: result.totalUsedArea,
      wastePercent: result.wastePercent,
      generatedAt: new Date(),
    },
    slabs: result.slabs.map((slab, index) => ({
      slabNumber: index + 1,
      dimensions: `${slabWidth} × ${slabHeight} mm`,
      pieceCount: slab.placements.length,
      wastePercent: slab.wastePercent,
      pieces: slab.placements.map(p => ({
        label: p.label,
        width: p.width,
        height: p.height,
        x: p.x,
        y: p.y,
        rotated: p.rotated,
      })),
    })),
  };
}

/**
 * Trigger CSV download in browser
 */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
