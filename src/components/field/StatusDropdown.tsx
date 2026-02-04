'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';

const statuses = [
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ready_for_quote', label: 'Ready for Quote' },
  { value: 'completed', label: 'Completed' },
];

interface StatusDropdownProps {
  jobId: string;
  currentStatus: string;
}

export function StatusDropdown({ jobId, currentStatus }: StatusDropdownProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleStatusChange(newStatus: string) {
    if (newStatus === status) {
      setOpen(false);
      return;
    }

    setLoading(true);
    setOpen(false);

    try {
      const res = await fetch(`/api/field/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        throw new Error('Failed to update status');
      }

      setStatus(newStatus);
    } catch {
      // Revert on error — status stays unchanged
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            Change status
            <ChevronDown className="w-4 h-4" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-10 overflow-hidden">
          {statuses.map((s) => {
            const isReady = s.value === 'ready_for_quote';
            const isActive = s.value === status;

            return (
              <button
                key={s.value}
                type="button"
                onClick={() => handleStatusChange(s.value)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-zinc-700 text-white'
                    : isReady
                      ? 'text-amber-400 hover:bg-zinc-700'
                      : 'text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {s.label}
                {isReady && !isActive && (
                  <span className="ml-1 text-xs text-amber-500">★</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
