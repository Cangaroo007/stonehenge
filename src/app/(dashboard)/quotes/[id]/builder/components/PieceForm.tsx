'use client';

import { useState, useEffect } from 'react';
import EdgeSelector from './EdgeSelector';

interface QuotePiece {
  id: number;
  name: string;
  description: string | null;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  materialId: number | null;
  materialName: string | null;
  edgeTop: string | null;
  edgeBottom: string | null;
  edgeLeft: string | null;
  edgeRight: string | null;
  room: {
    id: number;
    name: string;
  };
}

interface Material {
  id: number;
  name: string;
  collection: string | null;
  pricePerSqm: number;
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

interface EdgeSelections {
  edgeTop: string | null;
  edgeBottom: string | null;
  edgeLeft: string | null;
  edgeRight: string | null;
}

interface PieceFormProps {
  piece?: QuotePiece;
  materials: Material[];
  edgeTypes: EdgeType[];
  roomNames: string[];
  onSave: (data: Partial<QuotePiece>, roomName: string) => void;
  onCancel: () => void;
  saving: boolean;
}

const ROOM_OPTIONS = ['Kitchen', 'Bathroom', 'Ensuite', 'Laundry', 'Outdoor', 'Other'];
const THICKNESS_OPTIONS = [
  { value: 20, label: '20mm' },
  { value: 40, label: '40mm' },
];

export default function PieceForm({
  piece,
  materials,
  edgeTypes,
  roomNames,
  onSave,
  onCancel,
  saving,
}: PieceFormProps) {
  const [name, setName] = useState(piece?.name || '');
  const [description, setDescription] = useState(piece?.description || '');
  const [lengthMm, setLengthMm] = useState(piece?.lengthMm?.toString() || '');
  const [widthMm, setWidthMm] = useState(piece?.widthMm?.toString() || '');
  const [thicknessMm, setThicknessMm] = useState(piece?.thicknessMm || 20);
  const [materialId, setMaterialId] = useState<number | null>(piece?.materialId || null);
  const [roomName, setRoomName] = useState(piece?.room?.name || 'Kitchen');
  const [edgeSelections, setEdgeSelections] = useState<EdgeSelections>({
    edgeTop: piece?.edgeTop || null,
    edgeBottom: piece?.edgeBottom || null,
    edgeLeft: piece?.edgeLeft || null,
    edgeRight: piece?.edgeRight || null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form when piece changes
  useEffect(() => {
    if (piece) {
      setName(piece.name);
      setDescription(piece.description || '');
      setLengthMm(piece.lengthMm.toString());
      setWidthMm(piece.widthMm.toString());
      setThicknessMm(piece.thicknessMm);
      setMaterialId(piece.materialId);
      setRoomName(piece.room.name);
      setEdgeSelections({
        edgeTop: piece.edgeTop || null,
        edgeBottom: piece.edgeBottom || null,
        edgeLeft: piece.edgeLeft || null,
        edgeRight: piece.edgeRight || null,
      });
    } else {
      setName('');
      setDescription('');
      setLengthMm('');
      setWidthMm('');
      setThicknessMm(20);
      setMaterialId(null);
      setRoomName('Kitchen');
      setEdgeSelections({
        edgeTop: null,
        edgeBottom: null,
        edgeLeft: null,
        edgeRight: null,
      });
    }
    setErrors({});
  }, [piece]);

  // Combine existing room names with default options
  const allRoomOptions = Array.from(new Set([...ROOM_OPTIONS, ...roomNames]));

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    const length = parseInt(lengthMm);
    if (!lengthMm || isNaN(length) || length <= 0) {
      newErrors.lengthMm = 'Length must be greater than 0';
    }

    const width = parseInt(widthMm);
    if (!widthMm || isNaN(width) || width <= 0) {
      newErrors.widthMm = 'Width must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const selectedMaterial = materials.find(m => m.id === materialId);

    onSave(
      {
        name: name.trim(),
        description: description.trim() || null,
        lengthMm: parseInt(lengthMm),
        widthMm: parseInt(widthMm),
        thicknessMm,
        materialId,
        materialName: selectedMaterial?.name || null,
        edgeTop: edgeSelections.edgeTop,
        edgeBottom: edgeSelections.edgeBottom,
        edgeLeft: edgeSelections.edgeLeft,
        edgeRight: edgeSelections.edgeRight,
      },
      roomName
    );
  };

  // Calculate area for display
  const area = lengthMm && widthMm
    ? ((parseInt(lengthMm) * parseInt(widthMm)) / 1_000_000).toFixed(2)
    : '0.00';

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Kitchen Island"
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="lengthMm" className="block text-sm font-medium text-gray-700 mb-1">
            Length (mm) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="lengthMm"
            value={lengthMm}
            onChange={(e) => setLengthMm(e.target.value)}
            placeholder="3600"
            min="1"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.lengthMm ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.lengthMm && <p className="mt-1 text-sm text-red-500">{errors.lengthMm}</p>}
        </div>
        <div>
          <label htmlFor="widthMm" className="block text-sm font-medium text-gray-700 mb-1">
            Width (mm) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="widthMm"
            value={widthMm}
            onChange={(e) => setWidthMm(e.target.value)}
            placeholder="650"
            min="1"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.widthMm ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.widthMm && <p className="mt-1 text-sm text-red-500">{errors.widthMm}</p>}
        </div>
      </div>

      {/* Area Display */}
      <div className="bg-gray-50 rounded-lg p-3 text-sm">
        <span className="text-gray-600">Calculated Area: </span>
        <span className="font-medium">{area} m²</span>
      </div>

      {/* Edge Selector */}
      {lengthMm && widthMm && parseInt(lengthMm) > 0 && parseInt(widthMm) > 0 && (
        <EdgeSelector
          lengthMm={parseInt(lengthMm)}
          widthMm={parseInt(widthMm)}
          edgeSelections={edgeSelections}
          edgeTypes={edgeTypes}
          onChange={setEdgeSelections}
        />
      )}

      {/* Thickness */}
      <div>
        <label htmlFor="thicknessMm" className="block text-sm font-medium text-gray-700 mb-1">
          Thickness
        </label>
        <select
          id="thicknessMm"
          value={thicknessMm}
          onChange={(e) => setThicknessMm(parseInt(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          {THICKNESS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Material */}
      <div>
        <label htmlFor="materialId" className="block text-sm font-medium text-gray-700 mb-1">
          Material
        </label>
        <select
          id="materialId"
          value={materialId || ''}
          onChange={(e) => setMaterialId(e.target.value ? parseInt(e.target.value) : null)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">Select material (optional)</option>
          {materials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.name}
              {material.collection ? ` - ${material.collection}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Room */}
      <div>
        <label htmlFor="roomName" className="block text-sm font-medium text-gray-700 mb-1">
          Room
        </label>
        <select
          id="roomName"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          {allRoomOptions.map((room) => (
            <option key={room} value={room}>
              {room}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Optional notes about this piece..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : piece ? 'Update Piece' : 'Add Piece'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="btn-secondary disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
