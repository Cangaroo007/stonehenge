'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { CameraCapture } from '@/components/field/CameraCapture';

interface CapturePageProps {
  params: Promise<{ id: string }>;
}

export default function CapturePage({ params }: CapturePageProps) {
  const { id: jobId } = use(params);
  const router = useRouter();
  const [capturedPhotos, setCapturedPhotos] = useState<
    { blob: Blob; previewUrl: string; location: { lat: number; lng: number } | null }[]
  >([]);
  const [showCamera, setShowCamera] = useState(true);

  function handleCapture(blob: Blob, location: { lat: number; lng: number } | null) {
    const previewUrl = URL.createObjectURL(blob);
    setCapturedPhotos((prev) => [...prev, { blob, previewUrl, location }]);
    setShowCamera(false);
  }

  function handleClose() {
    router.push(`/field/jobs/${jobId}`);
  }

  function handleTakeAnother() {
    setShowCamera(true);
  }

  function handleDone() {
    // Clean up preview URLs
    capturedPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    router.push(`/field/jobs/${jobId}`);
  }

  if (showCamera) {
    return <CameraCapture onCapture={handleCapture} onClose={handleClose} />;
  }

  // Success screen after capture
  const lastPhoto = capturedPhotos[capturedPhotos.length - 1];

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-lg font-semibold text-white">Photo captured</h2>
        <span className="text-sm text-zinc-400">
          {capturedPhotos.length} photo{capturedPhotos.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Last captured photo preview */}
      <div className="flex-1 flex items-center justify-center overflow-hidden bg-black">
        {lastPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lastPhoto.previewUrl}
            alt="Last captured photo"
            className="w-full h-full object-contain"
          />
        )}
      </div>

      {/* Location info */}
      {lastPhoto?.location && (
        <div className="px-4 py-2 bg-zinc-900 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 flex items-center gap-1.5">
            {/* Map pin icon */}
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
            GPS: {lastPhoto.location.lat.toFixed(6)}, {lastPhoto.location.lng.toFixed(6)}
          </p>
        </div>
      )}

      {/* Thumbnail strip (if multiple photos) */}
      {capturedPhotos.length > 1 && (
        <div className="flex gap-2 px-4 py-3 bg-zinc-900 border-t border-zinc-800 overflow-x-auto">
          {capturedPhotos.map((photo, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={photo.previewUrl}
              alt={`Photo ${i + 1}`}
              className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border-2 border-zinc-700"
            />
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-zinc-900 border-t border-zinc-800">
        <button
          onClick={handleTakeAnother}
          className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 text-white py-3.5 rounded-xl text-sm font-semibold active:bg-zinc-700 transition-colors"
        >
          {/* Camera icon */}
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
          </svg>
          Take another
        </button>
        <button
          onClick={handleDone}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 rounded-xl text-sm font-semibold active:bg-blue-700 transition-colors"
        >
          {/* Check icon */}
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          Done
        </button>
      </div>
    </div>
  );
}
