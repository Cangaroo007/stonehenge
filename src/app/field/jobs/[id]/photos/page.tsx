'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PhotoGrid } from '@/components/field/PhotoGrid';
import { PhotoViewer } from '@/components/field/PhotoViewer';
import type { Photo } from '@/components/field/PhotoGrid';

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export default function PhotoGalleryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const fetchPhotos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/field/jobs/${id}/photos`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load photos');
      }
      const data = await res.json();
      setPhotos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const handleDelete = async (photoId: string) => {
    if (!confirm('Delete this photo? This cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/field/photos/${photoId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to delete photo');
      }
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      setSelectedPhoto(null);
    } catch {
      alert('Failed to delete photo. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-zinc-400 hover:text-white"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>
          <h1 className="text-lg font-semibold">Photos</h1>
          <div className="w-16" />
        </div>
      </header>

      {/* Content */}
      <main>
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12">
            <LoaderIcon className="w-8 h-8 text-zinc-500 animate-spin mb-4" />
            <p className="text-zinc-500 text-sm">Loading photos…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <p className="text-red-400 mb-2">{error}</p>
            <button
              onClick={fetchPhotos}
              className="text-blue-400 text-sm underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <PhotoGrid photos={photos} onPhotoTap={setSelectedPhoto} />
        )}
      </main>

      {/* Floating Action Button — Add Photo */}
      <button
        onClick={() => router.push(`/field/jobs/${id}/photos/capture`)}
        className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-colors"
        aria-label="Add photo"
      >
        <CameraIcon className="w-6 h-6" />
      </button>

      {/* Full-screen viewer */}
      {selectedPhoto && (
        <PhotoViewer
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
