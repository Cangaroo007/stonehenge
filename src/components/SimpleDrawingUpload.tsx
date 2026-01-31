'use client';

import { useState, useRef } from 'react';

interface SimpleDrawingUploadProps {
  quoteId: number;
  customerId: number;
  onSuccess?: () => void;
}

export function SimpleDrawingUpload({ quoteId, customerId, onSuccess }: SimpleDrawingUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(false);

    console.log('[SimpleUpload UI] Starting upload:', {
      fileName: file.name,
      fileSize: file.size,
      quoteId,
      customerId,
    });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('quoteId', quoteId.toString());
      formData.append('customerId', customerId.toString());

      console.log('[SimpleUpload UI] Calling /api/drawings/simple-upload...');
      const response = await fetch('/api/drawings/simple-upload', {
        method: 'POST',
        body: formData,
      });

      console.log('[SimpleUpload UI] Response:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      console.log('[SimpleUpload UI] ✅ Success:', result);
      
      setSuccess(true);
      onSuccess?.();
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('[SimpleUpload UI] ❌ Error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 border border-green-500 bg-green-50 rounded-lg">
      <h3 className="font-semibold text-green-900 mb-2">🔧 Simple Upload Test</h3>
      <p className="text-sm text-green-700 mb-3">
        Direct upload to R2 + database (no AI analysis)
      </p>
      
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={handleFileSelect}
        disabled={uploading}
        className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50"
      />
      
      {uploading && (
        <div className="mt-2 text-sm text-blue-600">
          Uploading...
        </div>
      )}
      
      {error && (
        <div className="mt-2 text-sm text-red-600">
          ❌ Error: {error}
        </div>
      )}
      
      {success && (
        <div className="mt-2 text-sm text-green-600">
          ✅ Upload successful! Check database and refresh page.
        </div>
      )}
    </div>
  );
}
