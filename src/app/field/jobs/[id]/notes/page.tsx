'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useDebounce } from '@/lib/hooks/useDebounce';
import Link from 'next/link';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function FieldJobNotesPage() {
  const { id } = useParams<{ id: string }>();
  const [notes, setNotes] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

  const debouncedNotes = useDebounce(notes, 2000);

  // Fetch existing notes on mount
  useEffect(() => {
    async function fetchNotes() {
      try {
        const res = await fetch(`/api/field/jobs/${id}/notes`);
        if (res.ok) {
          const data = await res.json();
          setNotes(data.notes ?? '');
        }
      } catch (err) {
        console.error('Failed to load notes:', err);
      } finally {
        setLoading(false);
        // Allow a tick before disabling initial load guard
        setTimeout(() => setInitialLoad(false), 100);
      }
    }
    fetchNotes();
  }, [id]);

  // Auto-save when debounced value changes (skip initial load)
  const saveNotes = useCallback(
    async (text: string) => {
      setSaveStatus('saving');
      try {
        const res = await fetch(`/api/field/jobs/${id}/notes`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: text }),
        });
        if (res.ok) {
          setSaveStatus('saved');
        } else {
          setSaveStatus('error');
        }
      } catch {
        setSaveStatus('error');
      }
    },
    [id]
  );

  useEffect(() => {
    if (initialLoad) return;
    saveNotes(debouncedNotes);
  }, [debouncedNotes, saveNotes, initialLoad]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading notes...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/field/jobs/${id}`}
              className="text-gray-500 hover:text-gray-700"
            >
              &larr; Back
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">Job Notes</h1>
          </div>
          <StatusIndicator status={saveStatus} />
        </div>

        {/* Notes textarea */}
        <div className="card p-4">
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setSaveStatus('idle');
            }}
            placeholder="Type your field notes here... Auto-saves after 2 seconds."
            className="input min-h-[300px] resize-y"
            rows={12}
          />
          <p className="text-xs text-gray-400 mt-2">
            Notes auto-save 2 seconds after you stop typing.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusIndicator({ status }: { status: SaveStatus }) {
  switch (status) {
    case 'saving':
      return <span className="text-sm text-gray-500">Saving...</span>;
    case 'saved':
      return <span className="text-sm text-green-600">Saved &#10003;</span>;
    case 'error':
      return <span className="text-sm text-red-600">Save failed</span>;
    default:
      return null;
  }
}
