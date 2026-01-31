'use client';

import { useState, useEffect } from 'react';

interface DrawingThumbnailProps {
  drawingId: string;
  filename: string;
  onClick?: () => void;
  className?: string;
}

export function DrawingThumbnail({
  drawingId,
  filename,
  onClick,
  className = '',
}: DrawingThumbnailProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Check if file is a PDF based on filename or mime type
  const isPdf = filename.toLowerCase().endsWith('.pdf') || mimeType === 'application/pdf';

  useEffect(() => {
    let cancelled = false;

    async function fetchPresignedUrl() {
      try {
        const response = await fetch(`/api/drawings/${drawingId}/url`);
        if (!response.ok) throw new Error('Failed to get URL');
        const data = await response.json();
        if (!cancelled && data.url && !data.placeholder) {
          setImageUrl(data.url);
          setMimeType(data.mimeType);
        } else if (!cancelled) {
          setImageError(true);
        }
      } catch {
        if (!cancelled) setImageError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPresignedUrl();
    return () => { cancelled = true; };
  }, [drawingId]);

  if (loading) {
    return (
      <div className={`bg-gray-100 rounded-lg animate-pulse ${className}`} />
    );
  }

  if (imageError || !imageUrl) {
    return (
      <div className={`bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400 ${className}`}>
        <svg className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="text-xs">Failed to load</span>
      </div>
    );
  }

  // PDF Thumbnail - show icon and filename
  if (isPdf) {
    return (
      <div
        className={`relative rounded-lg overflow-hidden cursor-pointer group bg-gradient-to-br from-red-50 to-red-100 border border-red-200 ${className}`}
        onClick={onClick}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-red-600">
          {/* PDF Icon */}
          <svg className="h-12 w-12 mb-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
            <path d="M14 2v6h6M9 13h6M9 17h3" stroke="white" strokeWidth="1.5" fill="none"/>
          </svg>
          {/* PDF Label */}
          <div className="text-xs font-semibold uppercase tracking-wider">PDF</div>
          {/* Filename - truncated */}
          <div className="text-[10px] mt-1 text-center line-clamp-2 opacity-75">
            {filename}
          </div>
        </div>
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2">
            <svg className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // Image Thumbnail - display normally
  return (
    <div
      className={`relative rounded-lg overflow-hidden cursor-pointer group ${className}`}
      onClick={onClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={filename}
        className="absolute inset-0 w-full h-full object-contain bg-gray-50"
        onError={() => setImageError(true)}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2">
          <svg className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
