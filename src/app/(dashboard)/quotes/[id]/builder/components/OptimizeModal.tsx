'use client';

import React, { useState } from 'react';
import { SlabResults } from '@/components/slab-optimizer';
import { OptimizationResult } from '@/types/slab-optimization';

interface OptimizeModalProps {
  quoteId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function OptimizeModal({ quoteId, onClose, onSaved }: OptimizeModalProps) {
  const [slabWidth, setSlabWidth] = useState(3000);
  const [slabHeight, setSlabHeight] = useState(1400);
  const [kerfWidth, setKerfWidth] = useState(3);
  const [allowRotation, setAllowRotation] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runOptimization = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/quotes/${quoteId}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slabWidth,
          slabHeight,
          kerfWidth,
          allowRotation,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Optimization failed');
      }

      const data = await res.json();
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to optimize');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAndClose = () => {
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Slab Optimizer</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Settings */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-3">Slab Settings</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Width (mm)</label>
                <input
                  type="number"
                  value={slabWidth}
                  onChange={(e) => setSlabWidth(parseInt(e.target.value) || 3000)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Height (mm)</label>
                <input
                  type="number"
                  value={slabHeight}
                  onChange={(e) => setSlabHeight(parseInt(e.target.value) || 1400)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Kerf (mm)</label>
                <input
                  type="number"
                  value={kerfWidth}
                  onChange={(e) => setKerfWidth(parseInt(e.target.value) || 3)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allowRotation}
                    onChange={(e) => setAllowRotation(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Allow rotation</span>
                </label>
              </div>
            </div>

            <button
              onClick={runOptimization}
              disabled={isLoading}
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg
                       hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
            >
              {isLoading ? 'Optimizing...' : 'Run Optimization'}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <SlabResults
              result={result}
              slabWidth={slabWidth}
              slabHeight={slabHeight}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          {result && (
            <button
              onClick={handleSaveAndClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg
                       hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default OptimizeModal;
