'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewJobPage() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError('Customer name is required');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/field/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          siteAddress: siteAddress.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create job');
      }

      const job = await res.json();
      router.push(`/field/jobs/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 py-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/field/jobs"
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 active:bg-zinc-800 transition-colors"
        >
          <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h2 className="text-xl font-bold">New Job</h2>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="customerName" className="block text-sm font-medium text-zinc-300 mb-1.5">
            Customer Name <span className="text-red-400">*</span>
          </label>
          <input
            id="customerName"
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="e.g. Smith Residence"
            autoFocus
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-base text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="siteAddress" className="block text-sm font-medium text-zinc-300 mb-1.5">
            Site Address
          </label>
          <input
            id="siteAddress"
            type="text"
            value={siteAddress}
            onChange={(e) => setSiteAddress(e.target.value)}
            placeholder="e.g. 42 Ocean Drive, Surfers Paradise"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-base text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="contactPhone" className="block text-sm font-medium text-zinc-300 mb-1.5">
            Contact Phone
          </label>
          <input
            id="contactPhone"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="e.g. 0412 345 678"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-base text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting || !customerName.trim()}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-base font-semibold active:bg-blue-700 disabled:opacity-50 disabled:active:bg-blue-600 transition-colors"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating...
              </span>
            ) : (
              'Create Job'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
