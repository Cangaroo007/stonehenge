'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

type LocationData = { lat: number; lng: number } | null;

export default function CapturePage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [location, setLocation] = useState<LocationData>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Request GPS location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // Location denied or unavailable — continue without it
        }
      );
    }
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch {
      setCameraError('Could not access camera. Use the file picker below instead.');
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      setStream(null);
    }
  }, [stream]);

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      // Cleanup on unmount
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capture photo from video stream
  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
          setPreviewUrl(URL.createObjectURL(blob));
          stopCamera();
        }
      },
      'image/jpeg',
      0.85
    );
  }, [stopCamera]);

  // Handle file picker selection
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setCapturedBlob(file);
      setPreviewUrl(URL.createObjectURL(file));
      stopCamera();
    },
    [stopCamera]
  );

  // Retake — discard preview and restart camera
  const handleRetake = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setCapturedBlob(null);
    setPreviewUrl(null);
    startCamera();
  }, [previewUrl, startCamera]);

  // Upload the captured/selected photo
  const handleUsePhoto = useCallback(async () => {
    if (!capturedBlob) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('file', capturedBlob, `photo-${Date.now()}.jpg`);
    formData.append('jobId', jobId);
    if (location) {
      formData.append('gpsLat', location.lat.toString());
      formData.append('gpsLng', location.lng.toString());
    }

    try {
      const response = await fetch('/api/field/photos', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      toast.success('Photo uploaded');
      // Reset for another capture
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setCapturedBlob(null);
      setPreviewUrl(null);
      startCamera();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to upload photo'
      );
    } finally {
      setUploading(false);
    }
  }, [capturedBlob, jobId, location, previewUrl, startCamera]);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-300 hover:text-white"
        >
          ← Back
        </button>
        <h1 className="text-lg font-semibold">Capture Photo</h1>
        <div className="w-12" />
      </div>

      {/* Camera / Preview area */}
      <div className="flex-1 relative flex items-center justify-center bg-black">
        {previewUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={previewUrl}
            alt="Captured preview"
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-w-full max-h-full object-contain"
            />
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 p-6">
                <p className="text-gray-300 text-center text-sm">
                  {cameraError}
                </p>
              </div>
            )}
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="bg-gray-900 p-4 flex items-center justify-center gap-4">
        {previewUrl ? (
          <>
            <button
              onClick={handleRetake}
              disabled={uploading}
              className="px-6 py-3 bg-gray-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Retake
            </button>
            <button
              onClick={handleUsePhoto}
              disabled={uploading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Use Photo'}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-3 bg-gray-700 text-white rounded-lg text-sm font-medium"
            >
              Choose File
            </button>
            <button
              onClick={handleCapture}
              disabled={!stream}
              className="w-16 h-16 rounded-full bg-white border-4 border-gray-400 disabled:opacity-30"
              aria-label="Take photo"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="w-[72px]" /> {/* Spacer for alignment */}
          </>
        )}
      </div>

      {/* Location indicator */}
      {location && (
        <div className="bg-gray-800 text-gray-400 text-xs text-center py-1">
          GPS: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
        </div>
      )}
    </div>
  );
}
