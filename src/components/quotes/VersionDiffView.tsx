'use client';

import type { ChangeSummary } from '@/lib/quote-version-diff';

interface VersionDiffViewProps {
  summary: ChangeSummary;
}

export default function VersionDiffView({ summary }: VersionDiffViewProps) {
  const { fieldChanges, piecesAdded, piecesRemoved, piecesModified } = summary;

  const hasChanges =
    fieldChanges.length > 0 ||
    piecesAdded.length > 0 ||
    piecesRemoved.length > 0 ||
    piecesModified.length > 0;

  if (!hasChanges) {
    return (
      <p className="text-sm text-gray-500 italic py-2">
        No significant changes detected
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {fieldChanges.length > 0 && (
          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
            {fieldChanges.length} field change{fieldChanges.length !== 1 ? 's' : ''}
          </span>
        )}
        {piecesAdded.length > 0 && (
          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
            +{piecesAdded.length} piece{piecesAdded.length !== 1 ? 's' : ''} added
          </span>
        )}
        {piecesRemoved.length > 0 && (
          <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">
            -{piecesRemoved.length} piece{piecesRemoved.length !== 1 ? 's' : ''} removed
          </span>
        )}
        {piecesModified.length > 0 && (
          <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700">
            {piecesModified.length} piece{piecesModified.length !== 1 ? 's' : ''} modified
          </span>
        )}
      </div>

      {/* Field Changes */}
      {fieldChanges.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Field Changes</h4>
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            {fieldChanges.map((change, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-gray-600 font-medium">{change.label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-red-600 line-through">
                    {formatValue(change.oldValue)}
                  </span>
                  <span className="text-gray-400">&rarr;</span>
                  <span className="text-green-600 font-medium">
                    {formatValue(change.newValue)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pieces Added */}
      {piecesAdded.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Pieces Added</h4>
          <div className="space-y-1">
            {piecesAdded.map((piece, i) => (
              <div
                key={i}
                className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm"
              >
                <span className="font-medium text-green-800">{piece.name}</span>
                <span className="text-green-600 ml-2">
                  {piece.dimensions} &middot; {piece.room}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pieces Removed */}
      {piecesRemoved.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Pieces Removed</h4>
          <div className="space-y-1">
            {piecesRemoved.map((piece, i) => (
              <div
                key={i}
                className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm"
              >
                <span className="font-medium text-red-800 line-through">{piece.name}</span>
                <span className="text-red-600 ml-2 line-through">
                  {piece.dimensions} &middot; {piece.room}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pieces Modified */}
      {piecesModified.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Pieces Modified</h4>
          <div className="space-y-1">
            {piecesModified.map((piece, i) => (
              <div
                key={i}
                className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm"
              >
                <span className="font-medium text-amber-800">{piece.name}</span>
                <span className="text-amber-600 ml-2">{piece.room}</span>
                <ul className="mt-1 ml-4 list-disc text-amber-700">
                  {piece.changes.map((change, j) => (
                    <li key={j}>{change}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(none)';
  if (typeof value === 'number') {
    // Format currency-like numbers
    if (value % 1 !== 0 || value > 100) {
      return `$${value.toFixed(2)}`;
    }
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}
