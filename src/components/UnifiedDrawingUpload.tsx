'use client';

import { useRef } from 'react';
import { useDrawingUpload } from '@/hooks/useDrawingUpload';

interface UnifiedDrawingUploadProps {
  quoteId: number;
  onSuccess?: (drawing: any) => void;
  onError?: (error: string) => void;
  buttonText?: string;
  className?: string;
}

/**
 * Unified Drawing Upload Component
 * 
 * Simple, reliable file upload button that uses the unified upload system.
 * Use this component everywhere you need drawing uploads.
 */
export function UnifiedDrawingUpload({
  quoteId,
  onSuccess,
  onError,
  buttonText = 'Upload Drawing',
  className = '',
}: UnifiedDrawingUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, progress, error } = useDrawingUpload();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      console.log('[UnifiedDrawingUpload] File selected:', file.name);
      const drawing = await upload(file, quoteId);
      console.log('[UnifiedDrawingUpload] ✅ Upload complete:', drawing);
      onSuccess?.(drawing);
      
      // Clear the input so the same file can be uploaded again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      console.error('[UnifiedDrawingUpload] ❌ Upload failed:', err);
      onError?.(errorMessage);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
        onChange={handleFileChange}
        disabled={uploading}
        className="hidden"
      />
      
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={uploading}
        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? (
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
            Uploading... {progress}%
          </span>
        ) : (
          buttonText
        )}
      </button>

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}
