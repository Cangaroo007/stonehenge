'use client';

import Image from 'next/image';

interface Photo {
  id: string;
  fileKey: string;
  filename: string;
  takenAt: string;
  url: string;
}

interface PhotoGridProps {
  photos: Photo[];
  onPhotoTap: (photo: Photo) => void;
}

export type { Photo };

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

export function PhotoGrid({ photos, onPhotoTap }: PhotoGridProps) {
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <CameraIcon className="w-12 h-12 text-zinc-600 mb-4" />
        <p className="text-zinc-400">No photos yet</p>
        <p className="text-zinc-500 text-sm">Tap the camera to add photos</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1 p-1">
      {photos.map((photo) => (
        <button
          key={photo.id}
          onClick={() => onPhotoTap(photo)}
          className="aspect-square relative overflow-hidden rounded-sm"
        >
          <Image
            src={photo.url}
            alt={photo.filename}
            fill
            className="object-cover"
            sizes="33vw"
          />
        </button>
      ))}
    </div>
  );
}
