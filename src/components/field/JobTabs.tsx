'use client';

import Link from 'next/link';
import { Camera, Ruler, FileText } from 'lucide-react';

interface JobTabsProps {
  jobId: string;
  activeTab: string;
  counts: { photos: number; measurements: number };
}

const tabs = [
  { key: 'photos', label: 'Photos', icon: Camera },
  { key: 'measurements', label: 'Measurements', icon: Ruler },
  { key: 'notes', label: 'Notes', icon: FileText },
];

export function JobTabs({ jobId, activeTab, counts }: JobTabsProps) {
  return (
    <div className="border-b border-zinc-700">
      <nav className="flex">
        {tabs.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key;
          const count =
            key === 'photos'
              ? counts.photos
              : key === 'measurements'
                ? counts.measurements
                : null;

          return (
            <Link
              key={key}
              href={`/field/jobs/${jobId}?tab=${key}`}
              className={`flex-1 flex items-center justify-center gap-2 py-3 border-b-2 ${
                isActive
                  ? 'border-amber-500 text-amber-500'
                  : 'border-transparent text-zinc-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm">{label}</span>
              {count !== null && count > 0 && (
                <span className="bg-zinc-700 text-xs px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
