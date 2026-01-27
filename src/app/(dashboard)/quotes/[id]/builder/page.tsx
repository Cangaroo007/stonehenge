'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import QuoteHeader from './components/QuoteHeader';
import PieceList from './components/PieceList';
import RoomGrouping from './components/RoomGrouping';
import PieceForm from './components/PieceForm';
import PricingSummary from './components/PricingSummary';
import QuoteActions from './components/QuoteActions';
import DrawingImport from './components/DrawingImport';
import { CutoutType, PieceCutout } from './components/CutoutSelector';
import type { CalculationResult } from '@/lib/types/pricing';

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
  cutouts: PieceCutout[];
  sortOrder: number;
  totalCost: number;
  room: {
    id: number;
    name: string;
  };
}

interface QuoteRoom {
  id: number;
  name: string;
  sortOrder: number;
  pieces: QuotePiece[];
}

interface Quote {
  id: number;
  quoteNumber: string;
  projectName: string | null;
  status: string;
  subtotal: number;
  total: number;
  customer: {
    id: number;
    name: string;
    company: string | null;
    clientType?: { id: string; name: string } | null;
    clientTier?: { id: string; name: string } | null;
  } | null;
  priceBook?: { id: string; name: string } | null;
  rooms: QuoteRoom[];
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

export default function QuoteBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.id as string;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [pieces, setPieces] = useState<QuotePiece[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [edgeTypes, setEdgeTypes] = useState<EdgeType[]>([]);
  const [cutoutTypes, setCutoutTypes] = useState<CutoutType[]>([]);
  const [rooms, setRooms] = useState<QuoteRoom[]>([]);
  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(null);
  const [isAddingPiece, setIsAddingPiece] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'rooms'>('list');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const calculationRef = useRef<CalculationResult | null>(null);
  const [showDrawingImport, setShowDrawingImport] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // Trigger recalculation after piece changes
  const triggerRecalculate = useCallback(() => {
    setRefreshTrigger(n => n + 1);
  }, []);

  // Store calculation result for QuoteActions
  const handleCalculationUpdate = useCallback((result: CalculationResult | null) => {
    setCalculation(result);
    calculationRef.current = result;
  }, []);

  // Flatten pieces from all rooms
  const flattenPieces = useCallback((quoteRooms: QuoteRoom[]): QuotePiece[] => {
    return quoteRooms.flatMap(room =>
      room.pieces.map(piece => ({
        ...piece,
        room: { id: room.id, name: room.name }
      }))
    ).sort((a, b) => a.sortOrder - b.sortOrder);
  }, []);

  // Fetch quote data
  const fetchQuote = useCallback(async () => {
    try {
      const response = await fetch(`/api/quotes/${quoteId}`);
      if (!response.ok) throw new Error('Failed to fetch quote');
      const data = await response.json();
      setQuote(data);
      setRooms(data.rooms || []);
      setPieces(flattenPieces(data.rooms || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quote');
    }
  }, [quoteId, flattenPieces]);

  // Fetch materials
  const fetchMaterials = useCallback(async () => {
    try {
      const response = await fetch('/api/materials');
      if (!response.ok) throw new Error('Failed to fetch materials');
      const data = await response.json();
      setMaterials(data);
    } catch (err) {
      console.error('Error fetching materials:', err);
    }
  }, []);

  // Fetch edge types
  const fetchEdgeTypes = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/pricing/edge-types');
      if (!response.ok) throw new Error('Failed to fetch edge types');
      const data = await response.json();
      // Filter to only active edge types
      setEdgeTypes(data.filter((e: EdgeType) => e.isActive));
    } catch (err) {
      console.error('Error fetching edge types:', err);
    }
  }, []);

  // Fetch cutout types
  const fetchCutoutTypes = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/pricing/cutout-types');
      if (!response.ok) throw new Error('Failed to fetch cutout types');
      const data = await response.json();
      // Filter to only active cutout types
      setCutoutTypes(data.filter((c: CutoutType) => c.isActive));
    } catch (err) {
      console.error('Error fetching cutout types:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchQuote(), fetchMaterials(), fetchEdgeTypes(), fetchCutoutTypes()]);
      setLoading(false);
    };
    loadData();
  }, [fetchQuote, fetchMaterials, fetchEdgeTypes, fetchCutoutTypes]);

  // Handle piece selection
  const handleSelectPiece = (pieceId: number) => {
    setIsAddingPiece(false);
    setSelectedPieceId(pieceId === selectedPieceId ? null : pieceId);
  };

  // Handle add piece
  const handleAddPiece = () => {
    setSelectedPieceId(null);
    setIsAddingPiece(true);
  };

  // Handle cancel form
  const handleCancelForm = () => {
    setSelectedPieceId(null);
    setIsAddingPiece(false);
  };

  // Handle save piece
  const handleSavePiece = async (pieceData: Partial<QuotePiece>, roomName: string) => {
    setSaving(true);
    try {
      const isNew = !selectedPieceId;
      const url = isNew
        ? `/api/quotes/${quoteId}/pieces`
        : `/api/quotes/${quoteId}/pieces/${selectedPieceId}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pieceData, roomName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save piece');
      }

      // Refresh quote data
      await fetchQuote();
      setSelectedPieceId(null);
      setIsAddingPiece(false);
      // Trigger pricing recalculation
      triggerRecalculate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save piece');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete piece
  const handleDeletePiece = async (pieceId: number) => {
    if (!confirm('Are you sure you want to delete this piece?')) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/pieces/${pieceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete piece');

      // Refresh quote data
      await fetchQuote();
      if (selectedPieceId === pieceId) {
        setSelectedPieceId(null);
      }
      // Trigger pricing recalculation
      triggerRecalculate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete piece');
    } finally {
      setSaving(false);
    }
  };

  // Handle duplicate piece
  const handleDuplicatePiece = async (pieceId: number) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/pieces/${pieceId}/duplicate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to duplicate piece');
      }

      const newPiece = await response.json();

      // Refresh quote data and select the new piece
      await fetchQuote();
      setSelectedPieceId(newPiece.id);
      setIsAddingPiece(false);
      // Trigger pricing recalculation
      triggerRecalculate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate piece');
    } finally {
      setSaving(false);
    }
  };

  // Handle reorder
  const handleReorder = async (reorderedPieces: { id: number; sortOrder: number }[]) => {
    try {
      const response = await fetch(`/api/quotes/${quoteId}/pieces/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pieces: reorderedPieces }),
      });

      if (!response.ok) throw new Error('Failed to reorder pieces');

      // Update local state optimistically
      setPieces(prev => {
        const updated = [...prev];
        reorderedPieces.forEach(({ id, sortOrder }) => {
          const piece = updated.find(p => p.id === id);
          if (piece) piece.sortOrder = sortOrder;
        });
        return updated.sort((a, b) => a.sortOrder - b.sortOrder);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder pieces');
      // Refresh to get correct order
      await fetchQuote();
    }
  };

  // Save quote with calculation
  const handleSaveQuote = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveCalculation: true,
          calculation: calculationRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save quote');
      }

      await fetchQuote();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save quote');
    } finally {
      setSaving(false);
    }
  };

  // Handle status change
  const handleStatusChange = async (newStatus: string) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      await fetchQuote();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  // Handle drawing import complete
  const handleImportComplete = useCallback(async (count: number) => {
    setShowDrawingImport(false);
    await fetchQuote();
    triggerRecalculate();
    setImportSuccessMessage(`Imported ${count} piece${count !== 1 ? 's' : ''} from drawing`);
    // Auto-clear success message after 5 seconds
    setTimeout(() => setImportSuccessMessage(null), 5000);
  }, [fetchQuote, triggerRecalculate]);

  // Get selected piece
  const selectedPiece = selectedPieceId
    ? pieces.find(p => p.id === selectedPieceId)
    : null;

  // Get unique room names
const roomNames = Array.from(new Set(rooms.map(r => r.name)));
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error && !quote) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <Link href="/quotes" className="btn-secondary">
          Back to Quotes
        </Link>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Quote not found</p>
        <Link href="/quotes" className="btn-secondary">
          Back to Quotes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Import Success Toast */}
      {importSuccessMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {importSuccessMessage}
          </span>
          <button onClick={() => setImportSuccessMessage(null)} className="text-green-700 hover:text-green-900">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Quote Header */}
      <QuoteHeader
        quote={quote}
        onBack={() => router.push(`/quotes/${quoteId}`)}
        saving={saving}
      />

      {/* Quote Actions */}
      <QuoteActions
        quoteId={quoteId}
        quoteStatus={quote.status}
        calculation={calculation}
        onSave={handleSaveQuote}
        onStatusChange={handleStatusChange}
        saving={saving}
      />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pieces List - 2 columns on large screens */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">Pieces</h2>
                {/* View Toggle */}
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'list'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => setViewMode('rooms')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'rooms'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    By Room
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDrawingImport(true)}
                  className="btn-secondary text-sm flex items-center gap-1"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Import Drawing
                </button>
                <button onClick={handleAddPiece} className="btn-primary text-sm">
                  + Add Piece
                </button>
              </div>
            </div>
            {viewMode === 'list' ? (
              <PieceList
                pieces={pieces}
                selectedPieceId={selectedPieceId}
                onSelectPiece={handleSelectPiece}
                onDeletePiece={handleDeletePiece}
                onDuplicatePiece={handleDuplicatePiece}
                onReorder={handleReorder}
              />
            ) : (
              <RoomGrouping
                pieces={pieces}
                selectedPieceId={selectedPieceId}
                onSelectPiece={handleSelectPiece}
                onDeletePiece={handleDeletePiece}
                onDuplicatePiece={handleDuplicatePiece}
              />
            )}
          </div>
        </div>

        {/* Piece Form / Summary - 1 column on large screens */}
        <div className="lg:col-span-1 space-y-6">
          {/* Piece Editor */}
          {(isAddingPiece || selectedPiece) ? (
            <div className="card">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">
                  {isAddingPiece ? 'Add New Piece' : 'Edit Piece'}
                </h2>
              </div>
              <PieceForm
                piece={selectedPiece || undefined}
                materials={materials}
                edgeTypes={edgeTypes}
                cutoutTypes={cutoutTypes}
                roomNames={roomNames}
                onSave={handleSavePiece}
                onCancel={handleCancelForm}
                saving={saving}
              />
            </div>
          ) : (
            <div className="card p-6 text-center text-gray-500">
              <svg className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <p className="font-medium">Select a piece to edit</p>
              <p className="text-sm mt-1">Click any piece to view and edit its details including edges</p>
            </div>
          )}

          {/* Pricing Summary */}
          <PricingSummary
            quoteId={quoteId}
            refreshTrigger={refreshTrigger}
            customerName={quote.customer?.company || quote.customer?.name}
            customerTier={quote.customer?.clientTier?.name}
            customerType={quote.customer?.clientType?.name}
            priceBookName={quote.priceBook?.name}
            onCalculationComplete={handleCalculationUpdate}
          />

          {/* Piece Stats */}
          <div className="card p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Piece Statistics</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Pieces:</span>
                <span className="font-medium">{pieces.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Area:</span>
                <span className="font-medium">
                  {pieces.reduce((sum, p) => sum + (p.lengthMm * p.widthMm) / 1_000_000, 0).toFixed(2)} m²
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Rooms:</span>
                <span className="font-medium">{rooms.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drawing Import Modal */}
      {showDrawingImport && (
        <DrawingImport
          quoteId={quoteId}
          edgeTypes={edgeTypes}
          onImportComplete={handleImportComplete}
          onClose={() => setShowDrawingImport(false)}
        />
      )}
    </div>
  );
}
