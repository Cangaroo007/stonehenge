'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface SyncButtonProps {
  fieldJobId: number;
  status: string;
  quoteId: number | null;
}

export default function SyncButton({ fieldJobId, status, quoteId }: SyncButtonProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  if (status === 'CONVERTED' && quoteId) {
    return (
      <button
        onClick={() => router.push(`/quotes/${quoteId}`)}
        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
        View Quote
      </button>
    );
  }

  if (status !== 'READY_FOR_QUOTE') {
    return null;
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/field/jobs/${fieldJobId}/sync`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.quoteId) {
          toast.success('Job already converted');
          router.push(`/quotes/${data.quoteId}`);
          return;
        }
        throw new Error(data.error || 'Failed to create quote');
      }

      toast.success(`Quote ${data.quoteNumber} created with ${data.pieceCount} piece(s)`);
      router.push(`/quotes/${data.quoteId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create quote';
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {syncing ? (
        <>
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Creating Quote...
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
          </svg>
          Create Quote
        </>
      )}
    </button>
  );
}
