'use client';

import Link from 'next/link';

interface JobCardProps {
  job: {
    id: string;
    customerName: string;
    siteAddress: string | null;
    status: string;
    _count: { photos: number; measurements: number };
    updatedAt: string;
  };
}

const STATUS_STYLES: Record<string, { bg: string; label: string }> = {
  IN_PROGRESS: { bg: 'bg-amber-500/20 text-amber-500', label: 'In Progress' },
  READY_FOR_QUOTE: { bg: 'bg-emerald-500/20 text-emerald-500', label: 'Ready for Quote' },
  CONVERTED: { bg: 'bg-blue-500/20 text-blue-500', label: 'Converted' },
  CANCELLED: { bg: 'bg-zinc-500/20 text-zinc-500', label: 'Cancelled' },
};

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
  });
}

export default function JobCard({ job }: JobCardProps) {
  const statusStyle = STATUS_STYLES[job.status] || STATUS_STYLES.IN_PROGRESS;

  return (
    <Link
      href={`/field/jobs/${job.id}`}
      className="block bg-zinc-900 border border-zinc-800 rounded-xl p-4 active:bg-zinc-800 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white truncate">{job.customerName}</h3>
          {job.siteAddress && (
            <p className="text-sm text-zinc-400 truncate mt-0.5">{job.siteAddress}</p>
          )}
        </div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusStyle.bg}`}
        >
          {statusStyle.label}
        </span>
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
          </svg>
          {job._count.photos}
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 6h10.5m-10.5 6h10.5m-10.5 6h10.5" />
          </svg>
          {job._count.measurements}
        </span>
        <span className="ml-auto">{formatRelativeDate(job.updatedAt)}</span>
      </div>
    </Link>
  );
}
