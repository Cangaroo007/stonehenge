'use client';

import { useState, useCallback } from 'react';

// API response types matching the new prompt format
interface AnalysisPiece {
  pieceNumber?: number;
  name: string;
  pieceType?: string;
  shape?: string;
  length: number;
  width: number;
  thickness: number;
  cutouts?: Array<{ type: string; notes?: string }>;
  notes?: string;
  confidence: number;
}

interface AnalysisRoom {
  name: string;
  pieces: AnalysisPiece[];
}

interface AnalysisMetadata {
  jobNumber?: string | null;
  defaultThickness?: number;
  defaultOverhang?: number;
}

interface AnalysisResult {
  success: boolean;
  drawingType?: 'cad_professional' | 'job_sheet' | 'hand_drawn' | 'architectural';
  metadata?: AnalysisMetadata;
  rooms: AnalysisRoom[];
  warnings?: string[];
  questionsForUser?: string[];
}

// UI types for editable pieces
interface ExtractedPiece {
  roomName: string;
  description: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  shape?: string;
  cutouts?: string;
  notes?: string;
  confidence: number;
  selected: boolean;
}

interface DrawingUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPieces: (roomName: string, pieces: Array<{
    description: string;
    lengthMm: number;
    widthMm: number;
    thicknessMm: number;
    selected: boolean;
  }>) => void;
  existingRoomNames: string[];
}

const ROOM_TYPES = [
  'Kitchen',
  'Bathroom',
  'Ensuite',
  'Laundry',
  'Pantry',
  "Butler's Pantry",
  'Powder Room',
  'Island',
  'TV Unit',
  'Other',
];

function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.7) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return 'text-green-600';
  if (confidence >= 0.5) return 'text-yellow-600';
  return 'text-red-600';
}

export default function DrawingUploadModal({
  isOpen,
  onClose,
  onAddPieces,
  existingRoomNames,
}: DrawingUploadModalProps) {
  const [step, setStep] = useState<'upload' | 'analyzing' | 'review'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPdfFile, setIsPdfFile] = useState(false);

  // Analysis results
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [extractedPieces, setExtractedPieces] = useState<ExtractedPiece[]>([]);

  const resetState = useCallback(() => {
    setStep('upload');
    setPreviewUrl(null);
    setError(null);
    setIsPdfFile(false);
    setAnalysis(null);
    setExtractedPieces([]);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFile = useCallback(async (file: File) => {
    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';

    if (!isImage && !isPdf) {
      setError('Please upload an image file (JPEG, PNG, GIF, WebP) or PDF');
      return;
    }

    setIsPdfFile(isPdf);

    // Create preview (use placeholder for PDFs)
    if (isImage) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null); // Will show PDF placeholder
    }

    setError(null);
    setStep('analyzing');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/analyze-drawing', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to analyze drawing');
      }

      if (data.success && data.analysis) {
        const analysisData = data.analysis as AnalysisResult;
        setAnalysis(analysisData);

        // Flatten rooms into editable pieces
        const pieces: ExtractedPiece[] = [];
        if (analysisData.rooms && Array.isArray(analysisData.rooms)) {
          for (const room of analysisData.rooms) {
            for (const piece of room.pieces) {
              const cutoutsStr = piece.cutouts?.map(c => c.type).join(', ') || '';
              pieces.push({
                roomName: room.name,
                description: piece.name || `Piece ${piece.pieceNumber || pieces.length + 1}`,
                lengthMm: piece.length,
                widthMm: piece.width,
                thicknessMm: piece.thickness || analysisData.metadata?.defaultThickness || 20,
                shape: piece.shape,
                cutouts: cutoutsStr,
                notes: piece.notes,
                confidence: piece.confidence,
                selected: true,
              });
            }
          }
        }

        setExtractedPieces(pieces);
        setStep('review');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze drawing');
      setStep('upload');
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processFile(e.dataTransfer.files[0]);
      }
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        processFile(e.target.files[0]);
      }
    },
    [processFile]
  );

  const togglePieceSelection = (index: number) => {
    setExtractedPieces((prev) =>
      prev.map((p, i) => (i === index ? { ...p, selected: !p.selected } : p))
    );
  };

  const updatePiece = (index: number, updates: Partial<ExtractedPiece>) => {
    setExtractedPieces((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...updates } : p))
    );
  };

  const handleAddToQuote = () => {
    const selectedPieces = extractedPieces.filter((p) => p.selected);
    if (selectedPieces.length === 0) {
      setError('Please select at least one piece to add');
      return;
    }

    // Group pieces by room name
    const piecesByRoom: Record<string, ExtractedPiece[]> = {};
    for (const piece of selectedPieces) {
      const roomName = piece.roomName || 'Room';
      if (!piecesByRoom[roomName]) {
        piecesByRoom[roomName] = [];
      }
      piecesByRoom[roomName].push(piece);
    }

    // Add pieces for each room
    for (const [baseName, roomPieces] of Object.entries(piecesByRoom)) {
      let roomName = baseName;

      // Handle duplicate room names
      if (existingRoomNames.includes(roomName)) {
        let counter = 2;
        while (existingRoomNames.includes(`${baseName} ${counter}`)) {
          counter++;
        }
        roomName = `${baseName} ${counter}`;
      }

      onAddPieces(
        roomName,
        roomPieces.map((p) => ({
          description: p.description,
          lengthMm: p.lengthMm,
          widthMm: p.widthMm,
          thicknessMm: p.thicknessMm,
          selected: true,
        }))
      );
    }

    handleClose();
  };

  // Get unique room names from extracted pieces
  const roomNames = Array.from(new Set(extractedPieces.map((p) => p.roomName)));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleClose} />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {step === 'upload' && 'Upload Drawing'}
              {step === 'analyzing' && 'Analyzing Drawing...'}
              {step === 'review' && 'Review Extracted Data'}
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-140px)]">
            {/* Error message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Upload Step */}
            {step === 'upload' && (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="mt-4 text-sm text-gray-600">
                  Drag and drop an architectural drawing here, or{' '}
                  <label className="text-primary-600 hover:text-primary-700 cursor-pointer font-medium">
                    browse
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf,application/pdf"
                      onChange={handleFileSelect}
                    />
                  </label>
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Supports PDF, JPEG, PNG, GIF, and WebP files
                </p>
              </div>
            )}

            {/* Analyzing Step */}
            {step === 'analyzing' && (
              <div className="text-center py-8">
                <div className="mb-6">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Uploaded drawing"
                      className="max-h-48 mx-auto rounded-lg shadow-md"
                    />
                  ) : isPdfFile ? (
                    <div className="mx-auto w-24 h-32 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center">
                      <svg className="w-12 h-12 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13H10v4H8.5v-1.5h-1v1.5H6v-4h1.5v1.5h1V13zm4 0H15c.55 0 1 .45 1 1v2c0 .55-.45 1-1 1h-2.5v-4zm1.5 3v-2h-1v2h1zm3-3h2v1h-1v.5h1v1h-1v1.5h-1V13z"/>
                      </svg>
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center justify-center gap-3">
                  <svg
                    className="animate-spin h-6 w-6 text-primary-600"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="text-gray-600">Analyzing {isPdfFile ? 'PDF' : 'drawing'} with AI...</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  This may take a few seconds
                </p>
              </div>
            )}

            {/* Review Step */}
            {step === 'review' && analysis && (
              <div className="space-y-6">
                {/* Drawing Preview and Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Uploaded drawing"
                        className="w-full h-48 object-contain rounded-lg bg-gray-100"
                      />
                    ) : isPdfFile ? (
                      <div className="w-full h-48 bg-red-50 border border-red-200 rounded-lg flex flex-col items-center justify-center">
                        <svg className="w-16 h-16 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13H10v4H8.5v-1.5h-1v1.5H6v-4h1.5v1.5h1V13zm4 0H15c.55 0 1 .45 1 1v2c0 .55-.45 1-1 1h-2.5v-4zm1.5 3v-2h-1v2h1zm3-3h2v1h-1v.5h1v1h-1v1.5h-1V13z"/>
                        </svg>
                        <span className="mt-2 text-sm text-red-600">PDF Document</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    {/* Drawing Type */}
                    {analysis.drawingType && (
                      <div className="text-sm">
                        <span className="text-gray-500">Drawing Type: </span>
                        <span className="font-medium text-gray-700">
                          {analysis.drawingType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                    )}

                    {/* Job Number */}
                    {analysis.metadata?.jobNumber && (
                      <div className="text-sm">
                        <span className="text-gray-500">Job Number: </span>
                        <span className="font-medium text-gray-700">{analysis.metadata.jobNumber}</span>
                      </div>
                    )}

                    {/* Default Settings */}
                    {analysis.metadata && (
                      <div className="text-sm">
                        <span className="text-gray-500">Defaults: </span>
                        <span className="font-medium text-gray-700">
                          {analysis.metadata.defaultThickness || 20}mm thick
                          {analysis.metadata.defaultOverhang && `, ${analysis.metadata.defaultOverhang}mm overhang`}
                        </span>
                      </div>
                    )}

                    {/* Room Summary */}
                    <div className="text-sm">
                      <span className="text-gray-500">Detected: </span>
                      <span className="font-medium text-gray-700">
                        {roomNames.length} room{roomNames.length !== 1 ? 's' : ''}, {extractedPieces.length} piece{extractedPieces.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Warnings */}
                {analysis.warnings && analysis.warnings.length > 0 && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                    <strong>Warnings:</strong>
                    <ul className="mt-1 list-disc list-inside">
                      {analysis.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Questions for User */}
                {analysis.questionsForUser && analysis.questionsForUser.length > 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                    <strong>Questions:</strong>
                    <ul className="mt-1 list-disc list-inside">
                      {analysis.questionsForUser.map((question, i) => (
                        <li key={i}>{question}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Extracted Pieces by Room */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Detected Pieces ({extractedPieces.filter((p) => p.selected).length} of {extractedPieces.length} selected)
                  </h3>

                  {roomNames.map((roomName) => {
                    const roomPieces = extractedPieces.filter((p) => p.roomName === roomName);
                    const roomPiecesWithIndices = roomPieces.map((p) => ({
                      piece: p,
                      index: extractedPieces.indexOf(p),
                    }));

                    return (
                      <div key={roomName} className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-sm font-medium text-gray-600">{roomName}</h4>
                          <span className="text-xs text-gray-400">
                            ({roomPieces.filter((p) => p.selected).length} of {roomPieces.length} selected)
                          </span>
                          {/* Room type selector */}
                          <select
                            className="ml-auto text-xs border-gray-200 rounded py-1"
                            value={roomPieces[0]?.roomName || roomName}
                            onChange={(e) => {
                              roomPiecesWithIndices.forEach(({ index }) => {
                                updatePiece(index, { roomName: e.target.value });
                              });
                            }}
                          >
                            {ROOM_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                            {!ROOM_TYPES.includes(roomName) && (
                              <option value={roomName}>{roomName}</option>
                            )}
                          </select>
                        </div>

                        <div className="space-y-2">
                          {roomPiecesWithIndices.map(({ piece, index }) => (
                            <div
                              key={index}
                              className={`border rounded-lg p-3 transition-colors ${
                                piece.selected
                                  ? 'border-primary-300 bg-primary-50'
                                  : 'border-gray-200 bg-gray-50'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={piece.selected}
                                  onChange={() => togglePieceSelection(index)}
                                  className="mt-1 h-4 w-4 text-primary-600 rounded"
                                />
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-2">
                                  <div className="md:col-span-2">
                                    <label className="block text-xs text-gray-500 mb-1">
                                      Description
                                    </label>
                                    <input
                                      type="text"
                                      className="input w-full text-sm py-1"
                                      value={piece.description}
                                      onChange={(e) =>
                                        updatePiece(index, { description: e.target.value })
                                      }
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">
                                      Length (mm)
                                    </label>
                                    <input
                                      type="number"
                                      className="input w-full text-sm py-1"
                                      value={piece.lengthMm}
                                      onChange={(e) =>
                                        updatePiece(index, { lengthMm: Number(e.target.value) })
                                      }
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">
                                      Width (mm)
                                    </label>
                                    <input
                                      type="number"
                                      className="input w-full text-sm py-1"
                                      value={piece.widthMm}
                                      onChange={(e) =>
                                        updatePiece(index, { widthMm: Number(e.target.value) })
                                      }
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">
                                      Thick (mm)
                                    </label>
                                    <input
                                      type="number"
                                      className="input w-full text-sm py-1"
                                      value={piece.thicknessMm}
                                      onChange={(e) =>
                                        updatePiece(index, { thicknessMm: Number(e.target.value) })
                                      }
                                    />
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className={`text-xs font-medium ${getConfidenceColor(piece.confidence)}`}>
                                    {Math.round(piece.confidence * 100)}%
                                  </span>
                                </div>
                              </div>
                              {/* Additional info row */}
                              {(piece.shape || piece.cutouts || piece.notes) && (
                                <div className="mt-2 ml-7 text-xs text-gray-500 flex flex-wrap gap-3">
                                  {piece.shape && (
                                    <span>
                                      <strong>Shape:</strong> {piece.shape}
                                    </span>
                                  )}
                                  {piece.cutouts && (
                                    <span>
                                      <strong>Cutouts:</strong> {piece.cutouts}
                                    </span>
                                  )}
                                  {piece.notes && (
                                    <span className="italic">{piece.notes}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {extractedPieces.length === 0 && (
                    <p className="text-center text-gray-500 py-4">
                      No pieces could be extracted from this drawing.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button onClick={handleClose} className="btn-secondary">
              Cancel
            </button>
            {step === 'review' && (
              <button
                onClick={handleAddToQuote}
                className="btn-primary"
                disabled={extractedPieces.filter((p) => p.selected).length === 0}
              >
                Add {extractedPieces.filter((p) => p.selected).length} Piece
                {extractedPieces.filter((p) => p.selected).length !== 1 ? 's' : ''} to Quote
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
