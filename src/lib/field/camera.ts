/**
 * Camera utilities for field photo capture.
 * Handles camera access, photo capture, GPS location, and stream cleanup.
 */

/**
 * Request camera access and return a MediaStream.
 */
export async function startCamera(
  facingMode: 'user' | 'environment' = 'environment'
): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode,
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  });
}

/**
 * Capture a photo from a video element as a JPEG Blob.
 */
export async function capturePhoto(
  video: HTMLVideoElement,
  quality: number = 0.8
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.drawImage(video, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to capture photo'))),
      'image/jpeg',
      quality
    );
  });
}

/**
 * Get GPS coordinates if permission is granted.
 * Returns null if geolocation is unavailable or denied.
 */
export async function getLocation(): Promise<{ lat: number; lng: number } | null> {
  if (!('geolocation' in navigator)) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    );
  });
}

/**
 * Stop all tracks in a MediaStream.
 */
export function stopCamera(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}
