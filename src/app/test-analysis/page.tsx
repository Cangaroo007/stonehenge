'use client';

import { useState, useCallback } from 'react';

// API Response Types
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
  material?: string;
}

interface AnalysisResult {
  success: boolean;
  drawingType?: 'cad_professional' | 'job_sheet' | 'hand_drawn' | 'architectural';
  metadata?: AnalysisMetadata;
  rooms: AnalysisRoom[];
  warnings?: string[];
  questionsForUser?: string[];
}

interface ApiResponse {
  success: boolean;
  analysis?: AnalysisResult;
  tokensUsed?: {
    input: number;
    output: number;
  };
  error?: string;
  details?: string;
}

// Confidence color helpers
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-green-600 bg-green-50';
  if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-50';
  if (confidence >= 0.5) return 'text-orange-600 bg-orange-50';
  return 'text-red-600 bg-red-50';
}

function getConfidenceBadgeColor(confidence: number): string {
  if (confidence >= 0.9) return 'bg-green-100 text-green-800 border-green-200';
  if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (confidence >= 0.5) return 'bg-orange-100 text-orange-800 border-orange-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

function formatDrawingType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function TestAnalysisPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Analysis results
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFile = useCallback((selectedFile: File) => {
    // Validate file type
    const isImage = selectedFile.type.startsWith('image/');
    const isPdfFile = selectedFile.type === 'application/pdf';

    if (!isImage && !isPdfFile) {
      setError('Please upload an image file (PNG, JPG) or PDF');
      return;
    }

    setFile(selectedFile);
    setIsPdf(isPdfFile);
    setError(null);
    setResponse(null);

    // Create preview for images
    if (isImage) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
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

  const handleAnalyze = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);
    setResponse(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/analyze-drawing', {
        method: 'POST',
        body: formData,
      });

      const data: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to analyze drawing');
      }

      setResponse(data);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze drawing');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreviewUrl(null);
    setIsPdf(false);
    setError(null);
    setResponse(null);
    setShowRawJson(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">AI Drawing Analysis Test</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload a drawing to test the AI analysis endpoint. This is a debug/test page.
          </p>
        </div>

        {/* Main Content Card */}
        <div className="card p-6 space-y-6">
          {/* File Upload Section */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">1. Upload Drawing</h2>

            {/* Error message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Dropzone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-primary-500 bg-primary-50'
                  : file
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="space-y-4">
                  {/* Preview */}
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-h-48 mx-auto rounded-lg shadow-md"
                    />
                  ) : isPdf ? (
                    <div className="mx-auto w-24 h-32 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center">
                      <svg className="w-12 h-12 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13H10v4H8.5v-1.5h-1v1.5H6v-4h1.5v1.5h1V13zm4 0H15c.55 0 1 .45 1 1v2c0 .55-.45 1-1 1h-2.5v-4zm1.5 3v-2h-1v2h1zm3-3h2v1h-1v.5h1v1h-1v1.5h-1V13z" />
                      </svg>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={handleClear}
                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    Clear and upload different file
                  </button>
                </div>
              ) : (
                <>
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
                    Drag and drop a drawing here, or{' '}
                    <label className="text-primary-600 hover:text-primary-700 cursor-pointer font-medium">
                      browse
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf,application/pdf"
                        onChange={handleFileSelect}
                        disabled={isAnalyzing}
                      />
                    </label>
                  </p>
                  <p className="mt-2 text-xs text-gray-500">Supports PNG, JPG, PDF files</p>
                </>
              )}
            </div>
          </div>

          {/* Analyze Button */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">2. Analyze</h2>
            <button
              onClick={handleAnalyze}
              disabled={!file || isAnalyzing}
              className="btn-primary w-full sm:w-auto"
            >
              {isAnalyzing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
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
                  Analyzing...
                </span>
              ) : (
                'Analyze Drawing'
              )}
            </button>
          </div>

          {/* Results Section */}
          {response && response.success && response.analysis && (
            <div className="space-y-6 border-t border-gray-200 pt-6">
              <h2 className="text-lg font-medium text-gray-900">3. Results</h2>

              {/* Token Usage */}
              {response.tokensUsed && (
                <div className="flex items-center gap-4 text-sm text-gray-500 bg-gray-100 rounded-lg p-3">
                  <span className="font-medium">Token Usage:</span>
                  <span>Input: {response.tokensUsed.input.toLocaleString()}</span>
                  <span>Output: {response.tokensUsed.output.toLocaleString()}</span>
                  <span className="text-gray-400">
                    Total: {(response.tokensUsed.input + response.tokensUsed.output).toLocaleString()}
                  </span>
                </div>
              )}

              {/* Drawing Type & Metadata */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h3 className="font-medium text-gray-900">Job Metadata</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Drawing Type:</span>
                    <p className="font-medium">
                      {response.analysis.drawingType
                        ? formatDrawingType(response.analysis.drawingType)
                        : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Job Number:</span>
                    <p className="font-medium">
                      {response.analysis.metadata?.jobNumber || 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Thickness:</span>
                    <p className="font-medium">
                      {response.analysis.metadata?.defaultThickness || 20}mm
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Overhang:</span>
                    <p className="font-medium">
                      {response.analysis.metadata?.defaultOverhang || 10}mm
                    </p>
                  </div>
                  {response.analysis.metadata?.material && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Material:</span>
                      <p className="font-medium">{response.analysis.metadata.material}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Warnings */}
              {response.analysis.warnings && response.analysis.warnings.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h3 className="font-medium text-yellow-800 mb-2">Warnings</h3>
                  <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                    {response.analysis.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Questions for User */}
              {response.analysis.questionsForUser && response.analysis.questionsForUser.length > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-medium text-blue-800 mb-2">Questions for User</h3>
                  <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                    {response.analysis.questionsForUser.map((question, i) => (
                      <li key={i}>{question}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Rooms and Pieces */}
              <div>
                <h3 className="font-medium text-gray-900 mb-4">
                  Detected Pieces ({response.analysis.rooms.reduce((acc, r) => acc + r.pieces.length, 0)} total)
                </h3>

                {response.analysis.rooms.map((room, roomIndex) => (
                  <div key={roomIndex} className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="bg-gray-200 px-2 py-0.5 rounded">{room.name}</span>
                      <span className="text-gray-400 text-xs">
                        {room.pieces.length} piece{room.pieces.length !== 1 ? 's' : ''}
                      </span>
                    </h4>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="table-header">Piece #</th>
                            <th className="table-header">Name</th>
                            <th className="table-header">Dimensions (L x W)</th>
                            <th className="table-header">Shape</th>
                            <th className="table-header text-center">Confidence</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {room.pieces.map((piece, pieceIndex) => (
                            <tr key={pieceIndex} className="hover:bg-gray-50">
                              <td className="table-cell font-mono">
                                {piece.pieceNumber ?? pieceIndex + 1}
                              </td>
                              <td className="table-cell">
                                <div>
                                  <span className="font-medium">{piece.name}</span>
                                  {piece.cutouts && piece.cutouts.length > 0 && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      Cutouts: {piece.cutouts.map((c) => c.type).join(', ')}
                                    </p>
                                  )}
                                  {piece.notes && (
                                    <p className="text-xs text-gray-400 mt-0.5 italic">
                                      {piece.notes}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="table-cell font-mono">
                                {piece.length} x {piece.width} mm
                              </td>
                              <td className="table-cell capitalize">{piece.shape || 'rectangular'}</td>
                              <td className="table-cell text-center">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded border text-xs font-medium ${getConfidenceBadgeColor(
                                    piece.confidence
                                  )}`}
                                >
                                  {Math.round(piece.confidence * 100)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {response.analysis.rooms.length === 0 && (
                  <p className="text-center text-gray-500 py-4">
                    No pieces could be extracted from this drawing.
                  </p>
                )}
              </div>

              {/* Raw JSON Response (Collapsible) */}
              <div className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <span className="font-medium text-gray-700">Raw JSON Response</span>
                  <svg
                    className={`h-5 w-5 text-gray-500 transition-transform ${
                      showRawJson ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {showRawJson && (
                  <div className="p-4 border-t border-gray-200">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                      {JSON.stringify(response, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Response Display */}
          {response && !response.success && (
            <div className="space-y-4 border-t border-gray-200 pt-6">
              <h2 className="text-lg font-medium text-gray-900">3. Error</h2>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="font-medium text-red-800 mb-2">Analysis Failed</h3>
                <p className="text-sm text-red-700">{response.error}</p>
                {response.details && (
                  <p className="text-xs text-red-600 mt-2">{response.details}</p>
                )}
              </div>

              {/* Raw JSON for debugging */}
              <div className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <span className="font-medium text-gray-700">Raw Error Response</span>
                  <svg
                    className={`h-5 w-5 text-gray-500 transition-transform ${
                      showRawJson ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {showRawJson && (
                  <div className="p-4 border-t border-gray-200">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                      {JSON.stringify(response, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Confidence Legend */}
        <div className="mt-6 card p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Confidence Legend</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded bg-green-500"></span>
              <span className="text-gray-600">90%+ (High - Clear CAD)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded bg-yellow-500"></span>
              <span className="text-gray-600">70-89% (Medium - Some ambiguity)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded bg-orange-500"></span>
              <span className="text-gray-600">50-69% (Low - Estimated)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded bg-red-500"></span>
              <span className="text-gray-600">&lt;50% (Review needed)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
