'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Version {
  id: number;
  version: number;
  changeType: string;
  changeReason: string | null;
  changeSummary: string | null;
  changedBy: { id: number; name: string; email: string };
  changedAt: string;
  rolledBackFromVersion: number | null;
  subtotal: string;
  totalAmount: string;
  pieceCount: number;
  isCurrent: boolean;
}

interface VersionHistoryTabProps {
  quoteId: number;
  onVersionSelect?: (version: number) => void;
}

const CHANGE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  CREATED: { label: 'Created', color: 'bg-green-100 text-green-700' },
  UPDATED: { label: 'Updated', color: 'bg-blue-100 text-blue-700' },
  PIECES_ADDED: { label: 'Pieces Added', color: 'bg-blue-100 text-blue-700' },
  PIECES_REMOVED: { label: 'Pieces Removed', color: 'bg-orange-100 text-orange-700' },
  PIECES_MODIFIED: { label: 'Pieces Modified', color: 'bg-blue-100 text-blue-700' },
  PRICING_RECALCULATED: { label: 'Pricing Updated', color: 'bg-purple-100 text-purple-700' },
  PRICING_OVERRIDE: { label: 'Price Override', color: 'bg-yellow-100 text-yellow-700' },
  DELIVERY_CHANGED: { label: 'Delivery Changed', color: 'bg-gray-100 text-gray-700' },
  STATUS_CHANGED: { label: 'Status Changed', color: 'bg-indigo-100 text-indigo-700' },
  SENT_TO_CLIENT: { label: 'Sent to Client', color: 'bg-blue-100 text-blue-700' },
  CLIENT_VIEWED: { label: 'Client Viewed', color: 'bg-gray-100 text-gray-700' },
  CLIENT_APPROVED: { label: 'Client Approved', color: 'bg-green-100 text-green-700' },
  CLIENT_REJECTED: { label: 'Client Rejected', color: 'bg-red-100 text-red-700' },
  REVISION_REQUESTED: { label: 'Revision Requested', color: 'bg-orange-100 text-orange-700' },
  ROLLED_BACK: { label: 'Rolled Back', color: 'bg-yellow-100 text-yellow-700' },
  IMPORTED_FROM_AI: { label: 'AI Import', color: 'bg-purple-100 text-purple-700' },
};

export default function VersionHistoryTab({ quoteId, onVersionSelect }: VersionHistoryTabProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentVersion, setCurrentVersion] = useState<number>(0);
  const [selectedVersion, setSelectedVersion] = useState<any | null>(null);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState<number | null>(null);
  const [rollbackReason, setRollbackReason] = useState('');
  const [rolling, setRolling] = useState(false);

  const fetchVersions = async () => {
    try {
      const response = await fetch(`/api/quotes/${quoteId}/versions`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setVersions(data.versions);
      setCurrentVersion(data.quote.currentVersion);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, [quoteId]);

  const handleViewVersion = async (version: number) => {
    try {
      const response = await fetch(`/api/quotes/${quoteId}/versions/${version}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setSelectedVersion(data);
      onVersionSelect?.(version);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load version details');
    }
  };

  const handleRollback = async (version: number) => {
    setRolling(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/versions/${version}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rollbackReason || undefined }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to rollback');
      }

      toast.success(`Restored to version ${version}`);
      setShowRollbackConfirm(null);
      setRollbackReason('');
      fetchVersions();
      
      // Refresh the page to show updated quote
      window.location.reload();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to rollback');
    } finally {
      setRolling(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Version History</h2>
        <span className="text-sm text-gray-500">
          {versions.length} version{versions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        <div className="space-y-4">
          {versions.map((version) => {
            const typeConfig = CHANGE_TYPE_LABELS[version.changeType] || {
              label: version.changeType,
              color: 'bg-gray-100 text-gray-700',
            };

            return (
              <div key={version.id} className="relative pl-10">
                {/* Timeline dot */}
                <div className={`absolute left-2 w-5 h-5 rounded-full border-2 ${
                  version.isCurrent 
                    ? 'bg-blue-500 border-blue-500' 
                    : 'bg-white border-gray-300'
                }`}>
                  {version.isCurrent && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </div>

                {/* Version card */}
                <div className={`bg-white border rounded-lg p-4 ${
                  version.isCurrent ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        Version {version.version}
                      </span>
                      {version.isCurrent && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                          Current
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-xs rounded-full ${typeConfig.color}`}>
                        {typeConfig.label}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {format(new Date(version.changedAt), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>

                  {/* Change summary */}
                  {version.changeSummary && (
                    <p className="text-sm text-gray-600 mb-2">{version.changeSummary}</p>
                  )}

                  {/* Rollback reference */}
                  {version.rolledBackFromVersion && (
                    <p className="text-sm text-yellow-600 mb-2">
                      ↩ Restored from version {version.rolledBackFromVersion}
                    </p>
                  )}

                  {/* Change reason */}
                  {version.changeReason && (
                    <p className="text-sm text-gray-500 italic mb-2">
                      &quot;{version.changeReason}&quot;
                    </p>
                  )}

                  {/* Stats row */}
                  <div className="flex gap-4 text-sm text-gray-500 mb-3">
                    <span>{version.pieceCount} pieces</span>
                    <span>Total: ${parseFloat(version.totalAmount).toFixed(2)}</span>
                    <span>By: {version.changedBy.name}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewVersion(version.version)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      View Details
                    </button>
                    {!version.isCurrent && (
                      <>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() => setShowRollbackConfirm(version.version)}
                          className="text-sm text-orange-600 hover:text-orange-800"
                        >
                          Restore This Version
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Version Detail Modal */}
      {selectedVersion && (
        <VersionDetailModal
          version={selectedVersion}
          onClose={() => setSelectedVersion(null)}
        />
      )}

      {/* Rollback Confirmation Modal */}
      {showRollbackConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Restore Version {showRollbackConfirm}?
            </h3>
            <p className="text-gray-600 mb-4">
              This will restore the quote to version {showRollbackConfirm}. 
              A new version will be created to preserve the current state.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <textarea
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Why are you restoring this version?"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRollbackConfirm(null);
                  setRollbackReason('');
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={rolling}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRollback(showRollbackConfirm)}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                disabled={rolling}
              >
                {rolling ? 'Restoring...' : 'Restore Version'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Version Detail Modal Component
interface VersionDetailModalProps {
  version: {
    version: number;
    changeType: string;
    changeSummary: string | null;
    changes: Record<string, { old: unknown; new: unknown }> | null;
    changedBy: { name: string };
    changedAt: string;
    snapshot: {
      pricing: {
        subtotal: number;
        taxAmount: number;
        total: number;
      };
      rooms: Array<{
        name: string;
        pieces: Array<{ name: string; widthMm: number; lengthMm: number }>;
      }>;
    };
  };
  onClose: () => void;
}

function VersionDetailModal({ version, onClose }: VersionDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Version {version.version} Details
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {format(new Date(version.changedAt), 'MMMM d, yyyy at h:mm a')} by {version.changedBy.name}
          </p>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Summary */}
          {version.changeSummary && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Change Summary</h4>
              <p className="text-gray-600">{version.changeSummary}</p>
            </div>
          )}

          {/* Changes */}
          {version.changes && Object.keys(version.changes).length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2">What Changed</h4>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                {Object.entries(version.changes).map(([field, { old: oldVal, new: newVal }]) => (
                  <div key={field} className="flex justify-between text-sm">
                    <span className="text-gray-600">{field}:</span>
                    <span>
                      <span className="text-red-600 line-through mr-2">{String(oldVal)}</span>
                      <span className="text-green-600">{String(newVal)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pricing Snapshot */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Pricing at This Version</h4>
            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">${version.snapshot.pricing.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tax:</span>
                <span className="font-medium">${version.snapshot.pricing.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1">
                <span className="text-gray-900 font-medium">Total:</span>
                <span className="font-bold text-lg">${version.snapshot.pricing.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Pieces Snapshot */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Pieces at This Version ({version.snapshot.rooms.reduce((sum, r) => sum + r.pieces.length, 0)} total)
            </h4>
            <div className="space-y-3">
              {version.snapshot.rooms.map((room, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium text-gray-800 mb-2">{room.name}</p>
                  <div className="space-y-1">
                    {room.pieces.map((piece, j) => (
                      <div key={j} className="text-sm text-gray-600 flex justify-between">
                        <span>{piece.name}</span>
                        <span>{piece.widthMm} × {piece.lengthMm}mm</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
