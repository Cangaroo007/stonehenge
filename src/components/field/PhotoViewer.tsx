'use client';

import Image from 'next/image';

interface PhotoViewerProps {
  photo: { id: string; url: string; filename: string };
  onClose: () => void;
  onDelete?: (id: string) => void;
}

function XIcon({ className }: { className?: string }) {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function PhotoViewer({ photo, onClose, onDelete }: PhotoViewerProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4">
        <button onClick={onClose} className="p-2" aria-label="Close">
          <XIcon className="w-6 h-6 text-white" />
        </button>
        <p className="text-white text-sm truncate max-w-[60%]">
          {photo.filename}
        </p>
        {onDelete && (
          <button
            onClick={() => onDelete(photo.id)}
            className="p-2 text-red-500"
            aria-label="Delete photo"
          >
            <TrashIcon className="w-6 h-6" />
          </button>
        )}
        {!onDelete && <div className="w-10" />}
      </div>

      {/* Photo */}
      <div className="flex-1 relative">
        <Image
          src={photo.url}
          alt={photo.filename}
          fill
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
}
