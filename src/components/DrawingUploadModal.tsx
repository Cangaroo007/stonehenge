'use client';

import { useState, useCallback } from 'react';

interface ExtractedPiece {
  description: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  notes?: string;
  selected: boolean;
  dimensionConfidence?: 'measured' | 'scaled' | 'estimated';
  pieceType?: 'benchtop' | 'splashback' | 'vanity' | 'waterfall' | 'sill' | 'other';
  isComplexShape?: boolean;
  edgeProfile?: string | null;
}

interface Cutout {
  type: string;
  subtype?: string | null;
  quantity: number;
  associatedPiece?: string;
  notes?: string | null;
}

interface EdgeProfile {
  profile: string;
  location: string;
  lengthMm?: number;
}

interface AnalysisResult {
  roomType: string;
  roomTypeConfidence: 'high' | 'medium' | 'low';
  roomTypeReasoning?: string;
  scaleDetected?: string | null;
  scaleSource?: string | null;
  pieces: Array<{
    description: string;
    lengthMm: number;
    widthMm: number;
    thicknessMm: number;
    notes?: string;
    dimensionConfidence?: 'measured' | 'scaled' | 'estimated';
    pieceType?: 'benchtop' | 'splashback' | 'vanity' | 'waterfall' | 'sill' | 'other';
    isComplexShape?: boolean;
    edgeProfile?: string | null;
  }>;
  cutouts?: Cutout[];
  edgeProfiles?: EdgeProfile[];
  drawingNotes?: string;
  warnings?: string[];
}

interface DrawingUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPieces: (roomName: string, pieces: ExtractedPiece[]) => void;
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
  'Other',
];

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
  const [selectedRoomType, setSelectedRoomType] = useState('');
  const [customRoomName, setCustomRoomName] = useState('');
  const [extractedPieces, setExtractedPieces] = useState<ExtractedPiece[]>([]);

  const resetState = useCallback(() => {
    setStep('upload');
    setPreviewUrl(null);
    setError(null);
    setIsPdfFile(false);
    setAnalysis(null);
    setSelectedRoomType('');
    setCustomRoomName('');
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
        throw new Error(data.error || 'Failed to analyze drawing');
      }

      if (data.success && data.analysis) {
        // Handle both old and new API response formats
        const analysisData = {
          ...data.analysis,
          // Normalize confidence field name (old: confidence, new: roomTypeConfidence)
          roomTypeConfidence: data.analysis.roomTypeConfidence || data.analysis.confidence || 'medium',
        };
        setAnalysis(analysisData);
        setSelectedRoomType(data.analysis.roomType);
        setExtractedPieces(
          data.analysis.pieces.map((p: AnalysisResult['pieces'][0]) => ({
            ...p,
            selected: true,
            dimensionConfidence: p.dimensionConfidence || 'estimated',
            pieceType: p.pieceType || 'benchtop',
            isComplexShape: p.isComplexShape || false,
            edgeProfile: p.edgeProfile || null,
          }))
        );
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

    // Determine room name
    let roomName = selectedRoomType;
    if (selectedRoomType === 'Other' || selectedRoomType === 'Unknown') {
      roomName = customRoomName || 'Room';
    }

    // Handle duplicate room names
    if (existingRoomNames.includes(roomName)) {
      let counter = 2;
      while (existingRoomNames.includes(`${roomName} ${counter}`)) {
        counter++;
      }
      roomName = `${roomName} ${counter}`;
    }

    onAddPieces(roomName, selectedPieces);
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleClose} />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
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
                {/* Warnings */}
                {analysis.warnings && analysis.warnings.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <svg className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <div className="font-medium text-amber-800">Attention Required</div>
                        <ul className="text-sm text-amber-700 mt-1 list-disc list-inside">
                          {analysis.warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview and Room Type */}
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
                    {/* Scale Detection Info */}
                    {analysis.scaleDetected && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                        <span className="font-medium text-green-800">Scale detected:</span>{' '}
                        <span className="text-green-700">{analysis.scaleDetected}</span>
                        {analysis.scaleSource && (
                          <span className="text-green-600 text-xs block">{analysis.scaleSource}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Room Type
                    </label>
                    <select
                      className="input w-full"
                      value={selectedRoomType}
                      onChange={(e) => setSelectedRoomType(e.target.value)}
                    >
                      {ROOM_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                      {!ROOM_TYPES.includes(analysis.roomType) && (
                        <option value={analysis.roomType}>{analysis.roomType}</option>
                      )}
                    </select>
                    {(selectedRoomType === 'Other' || selectedRoomType === 'Unknown') && (
                      <input
                        type="text"
                        className="input w-full mt-2"
                        placeholder="Enter room name"
                        value={customRoomName}
                        onChange={(e) => setCustomRoomName(e.target.value)}
                      />
                    )}
                    {analysis.roomTypeConfidence && (
                      <p className="mt-2 text-sm text-gray-500">
                        Detection confidence:{' '}
                        <span
                          className={`font-medium ${
                            analysis.roomTypeConfidence === 'high'
                              ? 'text-green-600'
                              : analysis.roomTypeConfidence === 'medium'
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}
                        >
                          {analysis.roomTypeConfidence}
                        </span>
                      </p>
                    )}
                    {analysis.roomTypeReasoning && (
                      <p className="mt-1 text-xs text-gray-500">
                        {analysis.roomTypeReasoning}
                      </p>
                    )}
                  </div>
                </div>

                {/* Drawing Notes */}
                {analysis.drawingNotes && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                    <strong>AI Notes:</strong> {analysis.drawingNotes}
                  </div>
                )}

                {/* Cutouts Detected */}
                {analysis.cutouts && analysis.cutouts.length > 0 && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <h4 className="font-medium text-purple-800 mb-2">Cutouts Detected</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysis.cutouts.map((cutout, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                        >
                          {cutout.type}
                          {cutout.subtype && ` (${cutout.subtype})`}
                          {cutout.quantity > 1 && ` ×${cutout.quantity}`}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-purple-600 mt-2">
                      These will need to be added as features to the relevant pieces
                    </p>
                  </div>
                )}

                {/* Edge Profiles Detected */}
                {analysis.edgeProfiles && analysis.edgeProfiles.length > 0 && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <h4 className="font-medium text-indigo-800 mb-2">Edge Profiles Detected</h4>
                    <div className="space-y-1">
                      {analysis.edgeProfiles.map((edge, index) => (
                        <div key={index} className="text-sm text-indigo-700">
                          <span className="font-medium capitalize">{edge.profile}</span>
                          {' - '}{edge.location}
                          {edge.lengthMm && ` (${edge.lengthMm}mm)`}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extracted Pieces */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Extracted Pieces ({extractedPieces.filter((p) => p.selected).length} selected)
                  </h3>
                  <div className="space-y-3">
                    {extractedPieces.map((piece, index) => (
                      <div
                        key={index}
                        className={`border rounded-lg p-4 transition-colors ${
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
                          <div className="flex-1">
                            {/* Badges row */}
                            <div className="flex flex-wrap gap-1 mb-2">
                              {/* Piece Type Badge */}
                              {piece.pieceType && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  piece.pieceType === 'benchtop' ? 'bg-blue-100 text-blue-800' :
                                  piece.pieceType === 'splashback' ? 'bg-green-100 text-green-800' :
                                  piece.pieceType === 'vanity' ? 'bg-pink-100 text-pink-800' :
                                  piece.pieceType === 'waterfall' ? 'bg-cyan-100 text-cyan-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {piece.pieceType}
                                </span>
                              )}
                              {/* Dimension Confidence Badge */}
                              {piece.dimensionConfidence && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  piece.dimensionConfidence === 'measured' ? 'bg-green-100 text-green-800' :
                                  piece.dimensionConfidence === 'scaled' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-orange-100 text-orange-800'
                                }`}>
                                  {piece.dimensionConfidence === 'measured' ? '✓ Measured' :
                                   piece.dimensionConfidence === 'scaled' ? '~ Scaled' :
                                   '? Estimated'}
                                </span>
                              )}
                              {/* Complex Shape Badge */}
                              {piece.isComplexShape && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                  Complex Shape
                                </span>
                              )}
                              {/* Edge Profile Badge */}
                              {piece.edgeProfile && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                                  {piece.edgeProfile} edge
                                </span>
                              )}
                            </div>
                            {/* Input fields */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                              <div className="md:col-span-2">
                                <label className="block text-xs text-gray-500 mb-1">
                                  Description
                                </label>
                                <input
                                  type="text"
                                  className="input w-full text-sm"
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
                                  className={`input w-full text-sm ${
                                    piece.dimensionConfidence === 'estimated' ? 'border-orange-300' : ''
                                  }`}
                                  value={piece.lengthMm}
                                  onChange={(e) =>
                                    updatePiece(index, { lengthMm: Number(e.target.value) })
                                  }
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">
                                  {piece.pieceType === 'splashback' ? 'Height (mm)' : 'Width (mm)'}
                                </label>
                                <input
                                  type="number"
                                  className={`input w-full text-sm ${
                                    piece.dimensionConfidence === 'estimated' ? 'border-orange-300' : ''
                                  }`}
                                  value={piece.widthMm}
                                  onChange={(e) =>
                                    updatePiece(index, { widthMm: Number(e.target.value) })
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        {piece.notes && (
                          <p className="mt-2 ml-7 text-xs text-gray-500">
                            <em>{piece.notes}</em>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
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
