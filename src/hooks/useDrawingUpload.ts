import { useState, useCallback } from 'react';

export interface UploadedDrawing {
  id: string;
  filename: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  quoteId: number;
}

export interface UseDrawingUploadReturn {
  upload: (file: File, quoteId: number) => Promise<UploadedDrawing>;
  uploading: boolean;
  progress: number;
  error: string | null;
  reset: () => void;
}

/**
 * Unified Drawing Upload Hook
 * 
 * Use this hook in ALL components that need to upload drawings.
 * It provides consistent error handling, progress tracking, and retry logic.
 * 
 * @example
 * const { upload, uploading, error } = useDrawingUpload();
 * 
 * const handleFile = async (file: File) => {
 *   try {
 *     const drawing = await upload(file, quoteId);
 *     console.log('Uploaded:', drawing);
 *   } catch (err) {
 *     console.error('Upload failed:', err);
 *   }
 * };
 */
export function useDrawingUpload(): UseDrawingUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  const upload = useCallback(async (file: File, quoteId: number): Promise<UploadedDrawing> => {
    console.log('[useDrawingUpload] Starting upload:', {
      filename: file.name,
      size: file.size,
      type: file.type,
      quoteId,
    });

    setUploading(true);
    setProgress(10);
    setError(null);

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('quoteId', quoteId.toString());

      setProgress(20);
      console.log('[useDrawingUpload] Calling unified upload API...');

      // Call the unified upload endpoint
      const response = await fetch('/api/drawings/upload-complete', {
        method: 'POST',
        body: formData,
      });

      setProgress(80);
      console.log('[useDrawingUpload] Response received:', {
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || `Upload failed (${response.status})`;
        console.error('[useDrawingUpload] Upload failed:', errorData);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setProgress(100);

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      console.log('[useDrawingUpload] ✅ Upload successful:', result.drawing);
      
      // Keep showing 100% briefly before resetting
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 500);

      return result.drawing;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      console.error('[useDrawingUpload] ❌ Upload error:', err);
      setError(errorMessage);
      setUploading(false);
      setProgress(0);
      throw err;
    }
  }, []);

  return {
    upload,
    uploading,
    progress,
    error,
    reset,
  };
}
