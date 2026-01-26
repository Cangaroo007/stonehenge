'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import QuoteHeader from './components/QuoteHeader';
import PieceList from './components/PieceList';
import PieceForm from './components/PieceForm';
import { formatCurrency } from '@/lib/utils';

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
  cutouts: unknown[];
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
  } | null;
  rooms: QuoteRoom[];
}

interface Material {
  id: number;
  name: string;
  collection: string | null;
  pricePerSqm: number;
}

export default function QuoteBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.id as string;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [pieces, setPieces] = useState<QuotePiece[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [rooms, setRooms] = useState<QuoteRoom[]>([]);
  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(null);
  const [isAddingPiece, setIsAddingPiece] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchQuote(), fetchMaterials()]);
      setLoading(false);
    };
    loadData();
  }, [fetchQuote, fetchMaterials]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete piece');
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

  // Calculate totals
  const calculateTotal = () => {
    return pieces.reduce((sum, piece) => sum + Number(piece.totalCost || 0), 0);
  };

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

      {/* Quote Header */}
      <QuoteHeader
        quote={quote}
        onBack={() => router.push(`/quotes/${quoteId}`)}
        saving={saving}
      />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pieces List - 2 columns on large screens */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Pieces</h2>
              <button onClick={handleAddPiece} className="btn-primary text-sm">
                + Add Piece
              </button>
            </div>
            <PieceList
              pieces={pieces}
              selectedPieceId={selectedPieceId}
              onSelectPiece={handleSelectPiece}
              onDeletePiece={handleDeletePiece}
              onReorder={handleReorder}
            />
          </div>
        </div>

        {/* Piece Form / Summary - 1 column on large screens */}
        <div className="lg:col-span-1 space-y-6">
          {/* Piece Editor */}
          {(isAddingPiece || selectedPiece) && (
            <div className="card">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">
                  {isAddingPiece ? 'Add New Piece' : 'Edit Piece'}
                </h2>
              </div>
              <PieceForm
                piece={selectedPiece || undefined}
                materials={materials}
                roomNames={roomNames}
                onSave={handleSavePiece}
                onCancel={handleCancelForm}
                saving={saving}
              />
            </div>
          )}

          {/* Summary */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Pieces:</span>
                <span className="font-medium">{pieces.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Area:</span>
                <span className="font-medium">
                  {pieces.reduce((sum, p) => sum + (p.lengthMm * p.widthMm) / 1_000_000, 0).toFixed(2)} m²
                </span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-semibold">Estimated Total:</span>
                  <span className="font-bold text-primary-600">
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                * Final pricing calculated in Prompts 3.2-3.4 with edges and cutouts
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
