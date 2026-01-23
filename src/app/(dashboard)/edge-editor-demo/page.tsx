'use client';

import { useState, useEffect } from 'react';
import { PieceEdgeEditor, createDefaultEdges } from '@/components/PieceEdgeEditor';
import type { EdgesConfig, PricingRule } from '@/components/PieceEdgeEditor';

export default function EdgeEditorDemoPage() {
  const [lengthMm, setLengthMm] = useState(2400);
  const [widthMm, setWidthMm] = useState(600);
  const [edges, setEdges] = useState<EdgesConfig>(() =>
    createDefaultEdges(2400, 600)
  );
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch pricing rules on mount
  useEffect(() => {
    const fetchRules = async () => {
      try {
        const response = await fetch('/api/pricing-rules');
        if (response.ok) {
          const data = await response.json();
          setPricingRules(data);
        }
      } catch (error) {
        console.error('Failed to fetch pricing rules:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRules();
  }, []);

  // Update edge lengths when dimensions change
  useEffect(() => {
    setEdges((prev) => ({
      ...prev,
      top: { ...prev.top, lengthMm: lengthMm },
      bottom: { ...prev.bottom, lengthMm: lengthMm },
      left: { ...prev.left, lengthMm: widthMm },
      right: { ...prev.right, lengthMm: widthMm },
    }));
  }, [lengthMm, widthMm]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Edge Editor Demo
        </h1>
        <p className="text-gray-600">
          Click on any edge of the stone piece to configure its profile and
          finish. The visual representation scales proportionally to the
          dimensions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Dimension Controls */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Piece Dimensions
          </h2>

          <div className="space-y-4">
            <div>
              <label className="label">Length (mm)</label>
              <input
                type="number"
                className="input"
                value={lengthMm}
                onChange={(e) => setLengthMm(Number(e.target.value) || 0)}
                min={100}
                max={10000}
              />
            </div>

            <div>
              <label className="label">Width (mm)</label>
              <input
                type="number"
                className="input"
                value={widthMm}
                onChange={(e) => setWidthMm(Number(e.target.value) || 0)}
                min={100}
                max={5000}
              />
            </div>
          </div>

          {/* Preset Sizes */}
          <div>
            <label className="label">Preset Sizes</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setLengthMm(2400);
                  setWidthMm(600);
                }}
                className="btn-secondary text-xs"
              >
                Benchtop (2400 x 600)
              </button>
              <button
                type="button"
                onClick={() => {
                  setLengthMm(1200);
                  setWidthMm(600);
                }}
                className="btn-secondary text-xs"
              >
                Island (1200 x 600)
              </button>
              <button
                type="button"
                onClick={() => {
                  setLengthMm(800);
                  setWidthMm(500);
                }}
                className="btn-secondary text-xs"
              >
                Vanity (800 x 500)
              </button>
              <button
                type="button"
                onClick={() => {
                  setLengthMm(600);
                  setWidthMm(600);
                }}
                className="btn-secondary text-xs"
              >
                Square (600 x 600)
              </button>
            </div>
          </div>
        </div>

        {/* Edge Editor */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Edge Configuration
          </h2>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : (
            <PieceEdgeEditor
              lengthMm={lengthMm}
              widthMm={widthMm}
              edges={edges}
              onChange={setEdges}
              pricingRules={pricingRules}
            />
          )}
        </div>
      </div>

      {/* JSON Preview */}
      <div className="mt-8 card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Edge Configuration Data
        </h2>
        <pre className="bg-gray-100 rounded-lg p-4 overflow-x-auto text-xs text-gray-700">
          {JSON.stringify(edges, null, 2)}
        </pre>
      </div>

      {/* Usage Instructions */}
      <div className="mt-8 card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Usage Example
        </h2>
        <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-xs text-gray-100">
          {`import { PieceEdgeEditor, createDefaultEdges } from '@/components/PieceEdgeEditor';
import type { EdgesConfig } from '@/components/PieceEdgeEditor';

const MyComponent = () => {
  const [edges, setEdges] = useState<EdgesConfig>(() =>
    createDefaultEdges(2400, 600)
  );

  return (
    <PieceEdgeEditor
      lengthMm={2400}
      widthMm={600}
      edges={edges}
      onChange={setEdges}
      pricingRules={pricingRules}
    />
  );
};`}
        </pre>
      </div>
    </div>
  );
}
