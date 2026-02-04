'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { StatusBadge } from './StatusBadge';
import { StatusDropdown } from './StatusDropdown';

interface JobHeaderProps {
  job: {
    id: string;
    customerName: string;
    siteAddress: string | null;
    status: string;
  };
}

export function JobHeader({ job }: JobHeaderProps) {
  return (
    <div className="bg-zinc-800 border-b border-zinc-700">
      {/* Back button + title */}
      <div className="flex items-center p-4">
        <Link href="/field/jobs" className="mr-3">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">
            {job.customerName}
          </h1>
          {job.siteAddress && (
            <p className="text-sm text-zinc-400 truncate">{job.siteAddress}</p>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="px-4 pb-4 flex items-center justify-between">
        <StatusBadge status={job.status} />
        <StatusDropdown jobId={job.id} currentStatus={job.status} />
      </div>
    </div>
  );
}
