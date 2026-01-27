'use client';

import React, { useState } from 'react';
import { optimizeSlabs } from '@/lib/services/slab-optimizer';
import { OptimizationResult, OptimizationInput } from '@/types/slab-optimization';
import { SlabResults } from '@/components/slab-optimizer';
import { generateCutListCSV, downloadCSV } from '@/lib/services/cut-list-generator';

interface PieceInput {
  id: string;
  width: string;
  height: string;
  label: string;
}

export default function OptimizePage() {
  // Slab settings
  const [slabWidth, setSlabWidth] = useState('3000');
  const [slabHeight, setSlabHeight] = useState('1400');
  const [kerfWidth, setKerfWidth] = useState('3');
  const [allowRotation, setAllowRotation] = useState(true);

  // Pieces
  const [pieces, setPieces] = useState<PieceInput[]>([
    { id: '1', width: '2000', height: '600', label: 'Piece 1' },
  ]);

  // Results
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add new piece
  const addPiece = () => {
    const newId = String(Date.now());
    setPieces([...pieces, {
      id: newId,
      width: '1000',
      height: '500',
      label: `Piece ${pieces.length + 1}`
    }]);
  };

  // Remove piece
  const removePiece = (id: string) => {
    setPieces(pieces.filter(p => p.id !== id));
  };

  // Update piece
  const updatePiece = (id: string, field: keyof PieceInput, value: string) => {
    setPieces(pieces.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  // Run optimization
  const runOptimization = () => {
    setError(null);
    setIsOptimizing(true);

    try {
      // Validate inputs
      const slabW = parseInt(slabWidth);
      const slabH = parseInt(slabHeight);
      const kerf = parseInt(kerfWidth);

      if (isNaN(slabW) || slabW <= 0) throw new Error('Invalid slab width');
      if (isNaN(slabH) || slabH <= 0) throw new Error('Invalid slab height');
      if (isNaN(kerf) || kerf < 0) throw new Error('Invalid kerf width');

      const validPieces = pieces
        .filter(p => p.width && p.height)
        .map(p => ({
          id: p.id,
          width: parseInt(p.width) || 0,
          height: parseInt(p.height) || 0,
          label: p.label || `Piece ${p.id}`,
        }))
        .filter(p => p.width > 0 && p.height > 0);

      if (validPieces.length === 0) {
        throw new Error('Add at least one valid piece');
      }

      const input: OptimizationInput = {
        pieces: validPieces,
        slabWidth: slabW,
        slabHeight: slabH,
        kerfWidth: kerf,
        allowRotation,
      };

      const optimizationResult = optimizeSlabs(input);
      setResult(optimizationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Optimization failed');
    } finally {
      setIsOptimizing(false);
    }
  };

  // Clear results
  const clearResults = () => {
    setResult(null);
    setError(null);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!result) return;

    const csv = generateCutListCSV(result, parseInt(slabWidth) || 3000, parseInt(slabHeight) || 1400);
    const filename = `cut-list-standalone-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csv, filename);
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Slab Optimizer
      </h1>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left column: Settings and Pieces */}
        <div className="space-y-6">
          {/* Slab Settings */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold text-gray-900 mb-4">Slab Settings</h2>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Width (mm)
                </label>
                <input
                  type="number"
                  value={slabWidth}
                  onChange={(e) => setSlabWidth(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Height (mm)
                </label>
                <input
                  type="number"
                  value={slabHeight}
                  onChange={(e) => setSlabHeight(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Kerf (mm)
                </label>
                <input
                  type="number"
                  value={kerfWidth}
                  onChange={(e) => setKerfWidth(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                checked={allowRotation}
                onChange={(e) => setAllowRotation(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Allow piece rotation</span>
            </label>
          </div>

          {/* Pieces */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-900">Pieces</h2>
              <button
                onClick={addPiece}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add Piece
              </button>
            </div>

            <div className="space-y-3">
              {pieces.map((piece) => (
                <div
                  key={piece.id}
                  className="flex gap-2 items-center p-3 bg-gray-50 rounded-lg"
                >
                  <input
                    type="text"
                    value={piece.label}
                    onChange={(e) => updatePiece(piece.id, 'label', e.target.value)}
                    placeholder="Label"
                    className="flex-1 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    type="number"
                    value={piece.width}
                    onChange={(e) => updatePiece(piece.id, 'width', e.target.value)}
                    placeholder="Width"
                    className="w-20 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-gray-400">x</span>
                  <input
                    type="number"
                    value={piece.height}
                    onChange={(e) => updatePiece(piece.id, 'height', e.target.value)}
                    placeholder="Height"
                    className="w-20 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-gray-400 text-sm">mm</span>
                  <button
                    onClick={() => removePiece(piece.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                    disabled={pieces.length === 1}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>

            {/* Run button */}
            <div className="mt-4 flex gap-3">
              <button
                onClick={runOptimization}
                disabled={isOptimizing || pieces.length === 0}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg
                         hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                         font-medium transition-colors"
              >
                {isOptimizing ? 'Optimizing...' : 'Run Optimization'}
              </button>
              {result && (
                <button
                  onClick={clearResults}
                  className="px-4 py-2 border border-gray-300 rounded-lg
                           hover:bg-gray-50 text-gray-700 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Results */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-900 mb-4">Results</h2>

          {result ? (
            <>
              <SlabResults
                result={result}
                slabWidth={parseInt(slabWidth) || 3000}
                slabHeight={parseInt(slabHeight) || 1400}
              />

              {/* Export Buttons */}
              <div className="mt-4 flex gap-2 justify-end print:hidden">
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50
                           text-gray-700 flex items-center gap-2 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50
                           text-gray-700 flex items-center gap-2 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <svg
                className="w-16 h-16 mx-auto mb-4 opacity-50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                />
              </svg>
              <p>Add pieces and run optimization to see results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
