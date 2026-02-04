'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import JobCard from '@/components/field/JobCard';

interface FieldJob {
  id: string;
  customerName: string;
  siteAddress: string | null;
  status: string;
  _count: { photos: number; measurements: number };
  updatedAt: string;
}

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'READY_FOR_QUOTE', label: 'Ready' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function JobListPage() {
  const [jobs, setJobs] = useState<FieldJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/field/jobs');
      if (!res.ok) {
        throw new Error('Failed to load jobs');
      }
      const data = await res.json();
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const filteredJobs = jobs.filter((job) => {
    if (statusFilter !== 'ALL' && job.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchesName = job.customerName.toLowerCase().includes(q);
      const matchesAddress = job.siteAddress?.toLowerCase().includes(q) ?? false;
      if (!matchesName && !matchesAddress) return false;
    }
    return true;
  });

  return (
    <div className="px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Jobs</h2>
        <Link
          href="/field/jobs/new"
          className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium active:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Job
        </Link>
      </div>

      {/* Search */}
      <div className="mb-3">
        <input
          type="search"
          placeholder="Search by customer or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
        />
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-3 -mx-4 px-4 scrollbar-none">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === filter.value
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 text-zinc-400 active:bg-zinc-700'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Job list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button
            onClick={fetchJobs}
            className="text-blue-400 text-sm font-medium active:text-blue-300"
          >
            Try again
          </button>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </div>
          <p className="text-zinc-400 text-sm mb-1">
            {jobs.length === 0 ? 'No jobs yet' : 'No matching jobs'}
          </p>
          <p className="text-zinc-600 text-xs mb-4">
            {jobs.length === 0
              ? 'Create your first field job to get started'
              : 'Try adjusting your search or filter'}
          </p>
          {jobs.length === 0 && (
            <Link
              href="/field/jobs/new"
              className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium active:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Job
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
