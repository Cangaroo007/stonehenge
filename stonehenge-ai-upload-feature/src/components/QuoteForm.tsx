'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { formatCurrency, calculateArea } from '@/lib/utils';
import DrawingUploadModal from './DrawingUploadModal';

interface Customer {
  id: number;
  name: string;
  company: string | null;
}

interface Material {
  id: number;
  name: string;
  collection: string | null;
  pricePerSqm: string | number;
}

interface PricingRule {
  id: number;
  category: string;
  name: string;
  price: string | number;
  priceType: string;
}

interface QuoteRoom {
  id: string;
  name: string;
  pieces: QuotePiece[];
}

interface QuotePiece {
  id: string;
  description: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  materialId: number | null;
  features: PieceFeature[];
}

interface PieceFeature {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface QuoteFormProps {
  customers: Customer[];
  materials: Material[];
  pricingRules: PricingRule[];
  nextQuoteNumber: string;
  userId?: number;
  initialData?: {
    id: number;
    quoteNumber: string;
    customerId: number | null;
    projectName: string | null;
    projectAddress: string | null;
    notes: string | null;
    rooms: Array<{
      id: number;
      name: string;
      pieces: Array<{
        id: number;
        description: string | null;
        lengthMm: number;
        widthMm: number;
        thicknessMm: number;
        materialId: number | null;
        features: Array<{
          id: number;
          name: string;
          quantity: number;
          unitPrice: string | number;
        }>;
      }>;
    }>;
  };
}

export default function QuoteForm({
  customers,
  materials,
  pricingRules,
  nextQuoteNumber,
  userId,
  initialData,
}: QuoteFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Form state
  const [customerId, setCustomerId] = useState<number | null>(initialData?.customerId || null);
  const [projectName, setProjectName] = useState(initialData?.projectName || '');
  const [projectAddress, setProjectAddress] = useState(initialData?.projectAddress || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [rooms, setRooms] = useState<QuoteRoom[]>(
    initialData?.rooms.map((r) => ({
      id: String(r.id),
      name: r.name,
      pieces: r.pieces.map((p) => ({
        id: String(p.id),
        description: p.description || '',
        lengthMm: p.lengthMm,
        widthMm: p.widthMm,
        thicknessMm: p.thicknessMm,
        materialId: p.materialId,
        features: p.features.map((f) => ({
          id: String(f.id),
          name: f.name,
          quantity: f.quantity,
          unitPrice: Number(f.unitPrice),
        })),
      })),
    })) || []
  );

  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showRoomSelector, setShowRoomSelector] = useState(false);

  const taxRate = 10;

  // Group pricing rules by category
  const featureOptions = pricingRules.filter(
    (r) => r.category === 'cutout' || r.category === 'feature'
  );

  // Calculate totals
  function calculatePieceCost(piece: QuotePiece): { materialCost: number; featuresCost: number; total: number } {
    const material = materials.find((m) => m.id === piece.materialId);
    const areaSqm = calculateArea(piece.lengthMm, piece.widthMm);
    const pricePerSqm = material ? Number(material.pricePerSqm) : 0;

    // Thickness multiplier
    let thicknessMultiplier = 1;
    if (piece.thicknessMm === 30) thicknessMultiplier = 1.3;
    if (piece.thicknessMm === 40) thicknessMultiplier = 1.5;

    const materialCost = areaSqm * pricePerSqm * thicknessMultiplier;
    const featuresCost = piece.features.reduce((sum, f) => sum + f.unitPrice * f.quantity, 0);

    return {
      materialCost,
      featuresCost,
      total: materialCost + featuresCost,
    };
  }

  function calculateTotals() {
    let subtotal = 0;
    rooms.forEach((room) => {
      room.pieces.forEach((piece) => {
        subtotal += calculatePieceCost(piece).total;
      });
    });
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  }

  const totals = calculateTotals();

  // Room management
  const roomTypes = ['Kitchen', 'Bathroom', 'Ensuite', 'Laundry', 'Pantry', 'Butler\'s Pantry', 'Powder Room', 'Other'];

  function addRoom() {
    setShowRoomSelector(true);
  }

  function addRoomWithType(roomType: string) {
    const usedNames = rooms.map((r) => r.name);
    let newName = roomType;
    
    // Handle duplicate names
    if (usedNames.includes(newName)) {
      let counter = 2;
      while (usedNames.includes(`${roomType} ${counter}`)) {
        counter++;
      }
      newName = `${roomType} ${counter}`;
    }

    setRooms([
      ...rooms,
      {
        id: `new-${Date.now()}`,
        name: newName,
        pieces: [],
      },
    ]);
    setShowRoomSelector(false);
  }

  // Handle pieces from drawing upload
  function handleAddPiecesFromDrawing(
    roomName: string,
    pieces: Array<{
      description: string;
      lengthMm: number;
      widthMm: number;
      thicknessMm: number;
      selected: boolean;
    }>
  ) {
    const newRoom: QuoteRoom = {
      id: `new-${Date.now()}`,
      name: roomName,
      pieces: pieces
        .filter((p) => p.selected)
        .map((p, index) => ({
          id: `new-${Date.now()}-${index}`,
          description: p.description,
          lengthMm: p.lengthMm,
          widthMm: p.widthMm,
          thicknessMm: p.thicknessMm,
          materialId: materials[0]?.id || null,
          features: [],
        })),
    };
    setRooms([...rooms, newRoom]);
    toast.success(`Added ${roomName} with ${newRoom.pieces.length} piece(s)`);
  }

  function removeRoom(roomId: string) {
    setRooms(rooms.filter((r) => r.id !== roomId));
  }

  function updateRoomName(roomId: string, name: string) {
    setRooms(rooms.map((r) => (r.id === roomId ? { ...r, name } : r)));
  }

  // Piece management
  function addPiece(roomId: string) {
    setRooms(
      rooms.map((r) =>
        r.id === roomId
          ? {
              ...r,
              pieces: [
                ...r.pieces,
                {
                  id: `new-${Date.now()}`,
                  description: '',
                  lengthMm: 1000,
                  widthMm: 600,
                  thicknessMm: 20,
                  materialId: materials[0]?.id || null,
                  features: [],
                },
              ],
            }
          : r
      )
    );
  }

  function removePiece(roomId: string, pieceId: string) {
    setRooms(
      rooms.map((r) =>
        r.id === roomId
          ? { ...r, pieces: r.pieces.filter((p) => p.id !== pieceId) }
          : r
      )
    );
  }

  function updatePiece(roomId: string, pieceId: string, updates: Partial<QuotePiece>) {
    setRooms(
      rooms.map((r) =>
        r.id === roomId
          ? {
              ...r,
              pieces: r.pieces.map((p) => (p.id === pieceId ? { ...p, ...updates } : p)),
            }
          : r
      )
    );
  }

  // Feature management
  function addFeature(roomId: string, pieceId: string) {
    const defaultFeature = featureOptions[0];
    if (!defaultFeature) return;

    setRooms(
      rooms.map((r) =>
        r.id === roomId
          ? {
              ...r,
              pieces: r.pieces.map((p) =>
                p.id === pieceId
                  ? {
                      ...p,
                      features: [
                        ...p.features,
                        {
                          id: `new-${Date.now()}`,
                          name: defaultFeature.name,
                          quantity: 1,
                          unitPrice: Number(defaultFeature.price),
                        },
                      ],
                    }
                  : p
              ),
            }
          : r
      )
    );
  }

  function removeFeature(roomId: string, pieceId: string, featureId: string) {
    setRooms(
      rooms.map((r) =>
        r.id === roomId
          ? {
              ...r,
              pieces: r.pieces.map((p) =>
                p.id === pieceId
                  ? { ...p, features: p.features.filter((f) => f.id !== featureId) }
                  : p
              ),
            }
          : r
      )
    );
  }

  function updateFeature(
    roomId: string,
    pieceId: string,
    featureId: string,
    updates: Partial<PieceFeature>
  ) {
    setRooms(
      rooms.map((r) =>
        r.id === roomId
          ? {
              ...r,
              pieces: r.pieces.map((p) =>
                p.id === pieceId
                  ? {
                      ...p,
                      features: p.features.map((f) =>
                        f.id === featureId ? { ...f, ...updates } : f
                      ),
                    }
                  : p
              ),
            }
          : r
      )
    );
  }

  function handleFeatureChange(roomId: string, pieceId: string, featureId: string, ruleName: string) {
    const rule = featureOptions.find((r) => r.name === ruleName);
    if (!rule) return;

    updateFeature(roomId, pieceId, featureId, {
      name: rule.name,
      unitPrice: Number(rule.price),
    });
  }

  // Save quote
  async function handleSave(status: string = 'draft') {
    setSaving(true);
    try {
      const payload = {
        quoteNumber: initialData?.quoteNumber || nextQuoteNumber,
        customerId,
        projectName,
        projectAddress,
        notes,
        status,
        rooms: rooms.map((r, ri) => ({
          name: r.name,
          sortOrder: ri,
          pieces: r.pieces.map((p, pi) => {
            const costs = calculatePieceCost(p);
            const material = materials.find((m) => m.id === p.materialId);
            return {
              description: p.description,
              lengthMm: p.lengthMm,
              widthMm: p.widthMm,
              thicknessMm: p.thicknessMm,
              materialId: p.materialId,
              materialName: material?.name || null,
              areaSqm: calculateArea(p.lengthMm, p.widthMm),
              materialCost: costs.materialCost,
              featuresCost: costs.featuresCost,
              totalCost: costs.total,
              sortOrder: pi,
              features: p.features.map((f) => ({
                name: f.name,
                quantity: f.quantity,
                unitPrice: f.unitPrice,
                totalPrice: f.unitPrice * f.quantity,
              })),
            };
          }),
        })),
        subtotal: totals.subtotal,
        taxRate,
        taxAmount: totals.taxAmount,
        total: totals.total,
        createdBy: userId,
      };

      const url = initialData ? `/api/quotes/${initialData.id}` : '/api/quotes';
      const method = initialData ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(initialData ? 'Quote updated!' : 'Quote created!');
        router.push(`/quotes/${data.id}`);
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save quote');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="label">Quote Number</label>
            <input
              type="text"
              className="input bg-gray-50"
              value={initialData?.quoteNumber || nextQuoteNumber}
              disabled
            />
          </div>
          <div>
            <label className="label">Customer</label>
            <select
              className="input"
              value={customerId || ''}
              onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Select customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company ? `(${c.company})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Project Name</label>
            <input
              type="text"
              className="input"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., Villa 48 - Kitchen & Bathrooms"
            />
          </div>
          <div>
            <label className="label">Project Address</label>
            <input
              type="text"
              className="input"
              value={projectAddress}
              onChange={(e) => setProjectAddress(e.target.value)}
              placeholder="Site address"
            />
          </div>
        </div>
      </div>

      {/* Rooms and Pieces */}
      <div className="space-y-4">
        {rooms.map((room) => (
          <div key={room.id} className="card">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-t-xl">
              <input
                type="text"
                className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                value={room.name}
                onChange={(e) => updateRoomName(room.id, e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => addPiece(room.id)}
                  className="btn-secondary text-sm"
                >
                  + Add Piece
                </button>
                <button
                  type="button"
                  onClick={() => removeRoom(room.id)}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  Remove Room
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {room.pieces.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No pieces yet.{' '}
                  <button
                    type="button"
                    onClick={() => addPiece(room.id)}
                    className="text-primary-600 hover:text-primary-700"
                  >
                    Add a piece
                  </button>
                </p>
              ) : (
                room.pieces.map((piece) => {
                  const costs = calculatePieceCost(piece);
                  return (
                    <div key={piece.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
                        <div className="md:col-span-2">
                          <label className="label">Description</label>
                          <input
                            type="text"
                            className="input"
                            value={piece.description}
                            onChange={(e) =>
                              updatePiece(room.id, piece.id, { description: e.target.value })
                            }
                            placeholder="e.g., Island Bench"
                          />
                        </div>
                        <div>
                          <label className="label">Length (mm)</label>
                          <input
                            type="number"
                            className="input"
                            value={piece.lengthMm}
                            onChange={(e) =>
                              updatePiece(room.id, piece.id, { lengthMm: Number(e.target.value) })
                            }
                          />
                        </div>
                        <div>
                          <label className="label">Width (mm)</label>
                          <input
                            type="number"
                            className="input"
                            value={piece.widthMm}
                            onChange={(e) =>
                              updatePiece(room.id, piece.id, { widthMm: Number(e.target.value) })
                            }
                          />
                        </div>
                        <div>
                          <label className="label">Thickness</label>
                          <select
                            className="input"
                            value={piece.thicknessMm}
                            onChange={(e) =>
                              updatePiece(room.id, piece.id, { thicknessMm: Number(e.target.value) })
                            }
                          >
                            <option value={20}>20mm</option>
                            <option value={30}>30mm</option>
                            <option value={40}>40mm</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">Material</label>
                          <select
                            className="input"
                            value={piece.materialId || ''}
                            onChange={(e) =>
                              updatePiece(room.id, piece.id, {
                                materialId: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                          >
                            <option value="">Select...</option>
                            {materials.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Features */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Features & Cutouts</span>
                          <button
                            type="button"
                            onClick={() => addFeature(room.id, piece.id)}
                            className="text-sm text-primary-600 hover:text-primary-700"
                          >
                            + Add Feature
                          </button>
                        </div>
                        {piece.features.length > 0 && (
                          <div className="space-y-2">
                            {piece.features.map((feature) => (
                              <div key={feature.id} className="flex items-center gap-2">
                                <select
                                  className="input flex-1"
                                  value={feature.name}
                                  onChange={(e) =>
                                    handleFeatureChange(room.id, piece.id, feature.id, e.target.value)
                                  }
                                >
                                  {featureOptions.map((opt) => (
                                    <option key={opt.id} value={opt.name}>
                                      {opt.name} ({formatCurrency(Number(opt.price))})
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  className="input w-20"
                                  value={feature.quantity}
                                  min={1}
                                  onChange={(e) =>
                                    updateFeature(room.id, piece.id, feature.id, {
                                      quantity: Number(e.target.value),
                                    })
                                  }
                                />
                                <span className="text-sm text-gray-600 w-24 text-right">
                                  {formatCurrency(feature.unitPrice * feature.quantity)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeFeature(room.id, piece.id, feature.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Piece Summary */}
                      <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                          {calculateArea(piece.lengthMm, piece.widthMm).toFixed(2)} m² ×{' '}
                          {piece.thicknessMm}mm
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-600">
                            Material: {formatCurrency(costs.materialCost)} | Features:{' '}
                            {formatCurrency(costs.featuresCost)}
                          </span>
                          <span className="font-semibold">{formatCurrency(costs.total)}</span>
                          <button
                            type="button"
                            onClick={() => removePiece(room.id, piece.id)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}

        <button type="button" onClick={addRoom} className="btn-secondary w-full">
          + Add Room
        </button>

        {/* Room Type Selector Modal */}
        {showRoomSelector && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowRoomSelector(false)} />
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <h3 className="text-lg font-semibold mb-4">Select Room Type</h3>
                <div className="grid grid-cols-2 gap-2">
                  {roomTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => addRoomWithType(type)}
                      className="btn-secondary text-left"
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowRoomSelector(false)}
                  className="mt-4 w-full btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Drawing Button */}
        <button
          type="button"
          onClick={() => setShowUploadModal(true)}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Upload Drawing (AI Extract)
        </button>

        {/* Drawing Upload Modal */}
        <DrawingUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onAddPieces={handleAddPiecesFromDrawing}
          existingRoomNames={rooms.map((r) => r.name)}
        />
      </div>

      {/* Notes */}
      <div className="card p-6">
        <label className="label">Notes (visible on quote)</label>
        <textarea
          className="input"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any special notes for this quote..."
        />
      </div>

      {/* Totals and Actions */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex justify-between gap-8">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-gray-600">GST ({taxRate}%):</span>
              <span className="font-medium">{formatCurrency(totals.taxAmount)}</span>
            </div>
            <div className="flex justify-between gap-8 text-lg">
              <span className="font-semibold">Total:</span>
              <span className="font-bold text-primary-600">{formatCurrency(totals.total)}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSave('draft')}
              className="btn-secondary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={() => handleSave('sent')}
              className="btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save & Mark as Sent'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
