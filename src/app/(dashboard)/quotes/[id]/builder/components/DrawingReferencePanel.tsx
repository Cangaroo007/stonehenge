'use client';

import { useState, useEffect } from 'react';
import { DrawingThumbnail } from '@/components/drawings/DrawingThumbnail';
import { DrawingViewerModal } from '@/components/drawings/DrawingViewerModal';

interface Drawing {
  id: string;
  filename: string;
  isPrimary: boolean;
  uploadedAt: string;
}

interface DrawingReferencePanelProps {
  quoteId: string;
  refreshKey?: number;
}

export function DrawingReferencePanel({ quoteId, refreshKey = 0 }: DrawingReferencePanelProps) {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedDrawing, setSelectedDrawing] = useState<Drawing | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    async function fetchDrawings() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/quotes/${quoteId}/drawings`);
        if (response.ok) {
          const data = await response.json();
          setDrawings(data);
        } else {
          const data = await response.json().catch(() => ({}));
          setError(data.error || 'Failed to load drawings');
        }
      } catch (err) {
        console.error('Error fetching drawings:', err);
        setError('Failed to load drawings');
      } finally {
        setLoading(false);
      }
    }

    fetchDrawings();
  }, [quoteId, refreshKey]);

  const primaryDrawing = drawings.find(d => d.isPrimary) || drawings[0];
  const hasDrawings = drawings.length > 0;

  if (loading) {
    return (
      <div className="card p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-4">
        <div className="text-center text-red-500 py-4">
          <svg className="h-10 w-10 mx-auto mb-2 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!hasDrawings) {
    return (
      <div className="card p-4">
        <div className="text-center text-gray-500 py-4">
          <svg className="h-10 w-10 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No drawing uploaded</p>
          <p className="text-xs text-gray-400 mt-1">Import a drawing to see it here</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-medium text-gray-900">Reference Drawing</span>
            {drawings.length > 1 && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {drawings.length} drawings
              </span>
            )}
          </div>
          <svg
            className={`h-5 w-5 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Content */}
        {!isCollapsed && (
          <div className="px-4 pb-4">
            {/* Primary Drawing Thumbnail */}
            {primaryDrawing && (
              <DrawingThumbnail
                drawingId={primaryDrawing.id}
                filename={primaryDrawing.filename}
                onClick={() => {
                  setSelectedDrawing(primaryDrawing);
                  setViewerOpen(true);
                }}
                className="h-40 w-full bg-gray-100"
              />
            )}

            {/* Multiple drawings selector */}
            {drawings.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {drawings.map((drawing) => (
                  <button
                    key={drawing.id}
                    onClick={() => {
                      setSelectedDrawing(drawing);
                      setViewerOpen(true);
                    }}
                    className={`flex-shrink-0 relative rounded border-2 overflow-hidden ${
                      drawing.isPrimary ? 'border-primary-500' : 'border-gray-200'
                    }`}
                  >
                    <DrawingThumbnail
                      drawingId={drawing.id}
                      filename={drawing.filename}
                      className="h-12 w-16"
                    />
                    {drawing.isPrimary && (
                      <span className="absolute bottom-0 left-0 right-0 bg-primary-500 text-white text-[10px] text-center">
                        Primary
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Filename */}
            <p className="text-xs text-gray-500 mt-2 truncate">
              {primaryDrawing?.filename}
            </p>
          </div>
        )}
      </div>

      {/* Viewer Modal */}
      {selectedDrawing && (
        <DrawingViewerModal
          drawingId={selectedDrawing.id}
          filename={selectedDrawing.filename}
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}
