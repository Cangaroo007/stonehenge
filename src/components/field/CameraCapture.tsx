'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { startCamera, capturePhoto, stopCamera, getLocation } from '@/lib/field/camera';

interface CameraCaptureProps {
  onCapture: (blob: Blob, location: { lat: number; lng: number } | null) => void;
  onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      stopCamera(streamRef.current);
      streamRef.current = null;
    }
  }, []);

  const initCamera = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      cleanupStream();
      const newStream = await startCamera(facingMode);
      streamRef.current = newStream;
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch {
      setError('Camera access denied. Please grant permission in your browser settings.');
    } finally {
      setLoading(false);
    }
  }, [facingMode, cleanupStream]);

  useEffect(() => {
    initCamera();
    return cleanupStream;
  }, [initCamera, cleanupStream]);

  async function handleCapture() {
    if (!videoRef.current) return;
    try {
      const blob = await capturePhoto(videoRef.current);
      setCapturedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      setError('Failed to capture photo. Please try again.');
    }
  }

  function handleRetake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCapturedBlob(null);
    setPreviewUrl(null);
  }

  async function handleUse() {
    if (!capturedBlob) return;
    const location = await getLocation();
    onCapture(capturedBlob, location);
  }

  function toggleCamera() {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
    // Clear any existing preview when switching
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setCapturedBlob(null);
      setPreviewUrl(null);
    }
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mb-4">
          {/* Camera off icon */}
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 0 1-2.25-2.25V9m12.841 9.091L16.5 19.5m-1.409-5.409a2.25 2.25 0 0 1-3.182 0m0 0-2.659-2.659M12 18.75l-7.5-7.5" />
          </svg>
        </div>
        <p className="text-white text-center font-medium mb-2">Camera unavailable</p>
        <p className="text-zinc-400 text-sm text-center mb-6">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-zinc-800 text-white rounded-xl text-sm font-medium active:bg-zinc-700 transition-colors"
          >
            Go back
          </button>
          <button
            onClick={initCamera}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium active:bg-blue-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Preview mode (after capture)
  if (previewUrl) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        {/* Preview image */}
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Captured photo preview"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-6 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] bg-black/80">
          <button
            onClick={handleRetake}
            className="flex flex-col items-center gap-1.5 active:opacity-70 transition-opacity"
          >
            <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center">
              {/* Retake / RotateCcw icon */}
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
              </svg>
            </div>
            <span className="text-white text-xs font-medium">Retake</span>
          </button>

          <button
            onClick={handleUse}
            className="flex flex-col items-center gap-1.5 active:opacity-70 transition-opacity"
          >
            <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center">
              {/* Check icon */}
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <span className="text-white text-xs font-medium">Use Photo</span>
          </button>
        </div>
      </div>
    );
  }

  // Live camera mode
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 absolute top-0 left-0 right-0 z-10">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center active:bg-black/70 transition-colors"
        >
          {/* X / Close icon */}
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <button
          onClick={toggleCamera}
          className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center active:bg-black/70 transition-colors"
        >
          {/* Switch camera icon */}
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
          </svg>
        </button>
      </div>

      {/* Video feed */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-zinc-400 text-sm">Starting camera...</span>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Capture button */}
      <div className="flex items-center justify-center py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] bg-black/60">
        <button
          onClick={handleCapture}
          disabled={loading}
          className="w-[72px] h-[72px] rounded-full border-4 border-white flex items-center justify-center active:scale-95 disabled:opacity-50 transition-transform"
        >
          <div className="w-[58px] h-[58px] rounded-full bg-white" />
        </button>
      </div>
    </div>
  );
}
