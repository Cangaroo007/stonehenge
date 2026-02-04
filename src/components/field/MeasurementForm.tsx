'use client';

import { useState } from 'react';

interface MeasurementFormProps {
  jobId: string;
  initialData?: {
    id?: string;
    room?: string;
    piece?: string;
    length: number;
    width: number;
    thickness: number;
    finishedEdges?: string;
    notes?: string;
  };
  onSave: () => void;
  onCancel: () => void;
}

const ROOMS = ['Kitchen', 'Bathroom', 'Laundry', 'Vanity', 'Other'];
const THICKNESSES = [20, 40];
const EDGES = ['Front', 'Back', 'Left', 'Right'];

export function MeasurementForm({
  jobId,
  initialData,
  onSave,
  onCancel,
}: MeasurementFormProps) {
  const [room, setRoom] = useState(initialData?.room || '');
  const [piece, setPiece] = useState(initialData?.piece || '');
  const [length, setLength] = useState(initialData?.length?.toString() || '');
  const [width, setWidth] = useState(initialData?.width?.toString() || '');
  const [thickness, setThickness] = useState(initialData?.thickness || 20);
  const [selectedEdges, setSelectedEdges] = useState<string[]>(
    initialData?.finishedEdges?.split(', ').filter(Boolean) || []
  );
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    if (!length || !width) {
      setError('Length and width are required');
      return;
    }

    if (parseFloat(length) <= 0 || parseFloat(width) <= 0) {
      setError('Dimensions must be positive');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = initialData?.id
        ? `/api/field/jobs/${jobId}/measurements/${initialData.id}`
        : `/api/field/jobs/${jobId}/measurements`;

      const response = await fetch(url, {
        method: initialData?.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: room || null,
          piece: piece || null,
          length: parseFloat(length),
          width: parseFloat(width),
          thickness,
          finishedEdges: selectedEdges.join(', ') || null,
          notes: notes || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      onSave();
    } catch {
      setError('Failed to save measurement');
    } finally {
      setSaving(false);
    }
  }

  function toggleEdge(edge: string) {
    setSelectedEdges((prev) =>
      prev.includes(edge) ? prev.filter((e) => e !== edge) : [...prev, edge]
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      {/* Room dropdown */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Room
        </label>
        <select
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-3 bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">Select room...</option>
          {ROOMS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {/* Piece name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Piece Name
        </label>
        <input
          type="text"
          value={piece}
          onChange={(e) => setPiece(e.target.value)}
          placeholder="e.g., Island, Main Run"
          className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Dimensions - use inputMode="decimal" for numeric keyboard */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Length (mm)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={length}
            onChange={(e) => setLength(e.target.value)}
            placeholder="2400"
            className="w-full border border-gray-300 rounded-lg p-3 text-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Width (mm)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            placeholder="600"
            className="w-full border border-gray-300 rounded-lg p-3 text-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      {/* Thickness */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Thickness
        </label>
        <div className="flex gap-2">
          {THICKNESSES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setThickness(t)}
              className={`flex-1 py-3 rounded-lg border font-medium ${
                thickness === t
                  ? 'bg-primary-50 border-primary-500 text-primary-700'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {t}mm
            </button>
          ))}
        </div>
      </div>

      {/* Finished edges */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Finished Edges
        </label>
        <div className="flex flex-wrap gap-2">
          {EDGES.map((edge) => (
            <button
              key={edge}
              type="button"
              onClick={() => toggleEdge(edge)}
              className={`px-4 py-2 rounded-lg border font-medium ${
                selectedEdges.includes(edge)
                  ? 'bg-primary-50 border-primary-500 text-primary-700'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {edge}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any special notes..."
          rows={2}
          className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Error */}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}
