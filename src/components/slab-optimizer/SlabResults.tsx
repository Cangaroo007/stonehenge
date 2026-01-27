'use client';

import React from 'react';
import { OptimizationResult } from '@/types/slab-optimization';
import { SlabCanvas } from './SlabCanvas';

interface SlabResultsProps {
  result: OptimizationResult;
  slabWidth: number;
  slabHeight: number;
}

// Color palette for pieces (must match SlabCanvas)
const PIECE_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
];

export function SlabResults({ result, slabWidth, slabHeight }: SlabResultsProps) {
  if (result.totalSlabs === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No pieces to display
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4 flex flex-wrap gap-6">
        <div>
          <div className="text-sm text-gray-500">Total Slabs</div>
          <div className="text-2xl font-bold text-gray-900">{result.totalSlabs}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Material Used</div>
          <div className="text-2xl font-bold text-gray-900">
            {(result.totalUsedArea / 1000000).toFixed(2)} m²
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Waste</div>
          <div className={`text-2xl font-bold ${
            result.wastePercent < 15 ? 'text-green-600' :
            result.wastePercent < 25 ? 'text-amber-600' : 'text-red-600'
          }`}>
            {result.wastePercent.toFixed(1)}%
          </div>
        </div>
        {result.unplacedPieces.length > 0 && (
          <div>
            <div className="text-sm text-gray-500">Unplaced Pieces</div>
            <div className="text-2xl font-bold text-red-600">
              {result.unplacedPieces.length}
            </div>
          </div>
        )}
      </div>

      {/* Unplaced warning */}
      {result.unplacedPieces.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">
            ⚠️ {result.unplacedPieces.length} piece(s) could not be placed
          </p>
          <p className="text-red-600 text-sm mt-1">
            These pieces are too large for the slab dimensions.
          </p>
        </div>
      )}

      {/* Individual slabs */}
      <div className="grid gap-6">
        {result.slabs.map((slab) => (
          <div key={slab.slabIndex} className="border rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-gray-900">
                Slab {slab.slabIndex + 1}
              </h3>
              <div className="text-sm text-gray-500">
                {slab.placements.length} pieces · {slab.wastePercent.toFixed(1)}% waste
              </div>
            </div>

            <SlabCanvas
              slabWidth={slabWidth}
              slabHeight={slabHeight}
              placements={slab.placements}
              showLabels={true}
              showDimensions={true}
            />

            {/* Piece list for this slab */}
            <div className="mt-3 flex flex-wrap gap-2">
              {slab.placements.map((p, i) => (
                <span
                  key={p.pieceId}
                  className="inline-flex items-center px-2 py-1 rounded text-xs text-white"
                  style={{ backgroundColor: PIECE_COLORS[i % PIECE_COLORS.length] }}
                >
                  {p.label} ({p.width}×{p.height})
                  {p.rotated && ' ↻'}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { PIECE_COLORS };
export default SlabResults;
