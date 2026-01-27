'use client';

interface QuotePiece {
  id: number;
  name: string;
  description: string | null;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  materialName: string | null;
  edgeTop: string | null;
  edgeBottom: string | null;
  edgeLeft: string | null;
  edgeRight: string | null;
  sortOrder: number;
  totalCost: number;
  room: {
    id: number;
    name: string;
  };
}

interface PieceListProps {
  pieces: QuotePiece[];
  selectedPieceId: number | null;
  onSelectPiece: (pieceId: number) => void;
  onDeletePiece: (pieceId: number) => void;
  onDuplicatePiece: (pieceId: number) => void;
  onReorder: (pieces: { id: number; sortOrder: number }[]) => void;
}

// Format edge type ID to readable name
const formatEdgeName = (edgeId: string | null): string => {
  if (!edgeId) return '';
  // Convert kebab-case or snake_case to Title Case
  return edgeId
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

// Get edge summary string for a piece
const getEdgeSummary = (piece: QuotePiece): string => {
  const edges = [
    piece.edgeTop && `T`,
    piece.edgeBottom && `B`,
    piece.edgeLeft && `L`,
    piece.edgeRight && `R`,
  ].filter(Boolean);

  return edges.length > 0 ? edges.join(', ') : '';
};

// Check if piece has any edges
const hasEdges = (piece: QuotePiece): boolean => {
  return !!(piece.edgeTop || piece.edgeBottom || piece.edgeLeft || piece.edgeRight);
};

export default function PieceList({
  pieces,
  selectedPieceId,
  onSelectPiece,
  onDeletePiece,
  onDuplicatePiece,
  onReorder,
}: PieceListProps) {
  const handleMoveUp = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index === 0) return;

    const newPieces = [...pieces];
    const currentPiece = newPieces[index];
    const prevPiece = newPieces[index - 1];

    // Swap sort orders
    const reorderedPieces = [
      { id: currentPiece.id, sortOrder: prevPiece.sortOrder },
      { id: prevPiece.id, sortOrder: currentPiece.sortOrder },
    ];

    onReorder(reorderedPieces);
  };

  const handleMoveDown = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index === pieces.length - 1) return;

    const newPieces = [...pieces];
    const currentPiece = newPieces[index];
    const nextPiece = newPieces[index + 1];

    // Swap sort orders
    const reorderedPieces = [
      { id: currentPiece.id, sortOrder: nextPiece.sortOrder },
      { id: nextPiece.id, sortOrder: currentPiece.sortOrder },
    ];

    onReorder(reorderedPieces);
  };

  const handleDelete = (pieceId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeletePiece(pieceId);
  };

  const handleDuplicate = (pieceId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicatePiece(pieceId);
  };

  if (pieces.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <svg
          className="mx-auto h-12 w-12 text-gray-400 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <p className="mb-2">No pieces added yet</p>
        <p className="text-sm">Click &quot;Add Piece&quot; to start building your quote</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Dimensions
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Thickness
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Room
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Edges
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {pieces.map((piece, index) => (
            <tr
              key={piece.id}
              onClick={() => onSelectPiece(piece.id)}
              className={`cursor-pointer transition-colors ${
                selectedPieceId === piece.id
                  ? 'bg-primary-50 border-l-4 border-primary-500'
                  : 'hover:bg-gray-50'
              }`}
            >
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                {index + 1}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{piece.name}</div>
                {piece.materialName && (
                  <div className="text-xs text-gray-500">{piece.materialName}</div>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                {piece.lengthMm} × {piece.widthMm}mm
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                {piece.thicknessMm}mm
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                  {piece.room.name}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm">
                {hasEdges(piece) ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                    {getEdgeSummary(piece)}
                  </span>
                ) : (
                  <span className="text-gray-400 text-xs">None</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm">
                <div className="flex items-center gap-1">
                  {/* Move Up */}
                  <button
                    onClick={(e) => handleMoveUp(index, e)}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  {/* Move Down */}
                  <button
                    onClick={(e) => handleMoveDown(index, e)}
                    disabled={index === pieces.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {/* Duplicate */}
                  <button
                    onClick={(e) => handleDuplicate(piece.id, e)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Duplicate piece"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                  {/* Delete */}
                  <button
                    onClick={(e) => handleDelete(piece.id, e)}
                    className="p-1 text-red-400 hover:text-red-600"
                    title="Delete piece"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
