'use client';

export type CheckStatus = 'pass' | 'fail' | 'warn';

export interface ReadinessCheck {
  label: string;
  status: CheckStatus;
  detail?: string;
}

interface QuoteReadinessCheckerProps {
  checks: Array<ReadinessCheck | null | undefined | false>;
  className?: string;
}

const STATUS_CONFIG: Record<CheckStatus, { icon: string; bg: string; text: string; border: string }> = {
  pass: {
    icon: '✓',
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  warn: {
    icon: '!',
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  fail: {
    icon: '✗',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
};

export default function QuoteReadinessChecker({ checks, className = '' }: QuoteReadinessCheckerProps) {
  // Guard: remove any null/undefined/false entries that could have been spread
  // in from conditional expressions like: condition && { label, status }
  const safeChecks = checks.filter(Boolean) as ReadinessCheck[];

  const failures = safeChecks.filter(c => c.status === 'fail');
  const warnings = safeChecks.filter(c => c.status === 'warn');
  const passes = safeChecks.filter(c => c.status === 'pass');

  const allPassed = failures.length === 0 && warnings.length === 0;

  const summaryBg = allPassed
    ? 'bg-green-50 border-green-200'
    : failures.length > 0
    ? 'bg-red-50 border-red-200'
    : 'bg-yellow-50 border-yellow-200';

  const summaryText = allPassed
    ? 'text-green-800'
    : failures.length > 0
    ? 'text-red-800'
    : 'text-yellow-800';

  if (safeChecks.length === 0) {
    return null;
  }

  return (
    <div className={`rounded-lg border p-4 space-y-2 ${summaryBg} ${className}`}>
      {/* Summary header */}
      <div className={`flex items-center justify-between text-sm font-medium ${summaryText}`}>
        <span>
          {allPassed
            ? 'Quote is ready'
            : failures.length > 0
            ? `${failures.length} issue${failures.length !== 1 ? 's' : ''} to fix`
            : `${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`}
        </span>
        <span className="text-xs font-normal opacity-75">
          {passes.length}/{safeChecks.length} checks passed
        </span>
      </div>

      {/* Check list */}
      <ul className="space-y-1">
        {safeChecks.map((check, i) => {
          const cfg = STATUS_CONFIG[check.status] ?? STATUS_CONFIG.warn;
          return (
            <li
              key={`${check.label}-${i}`}
              className={`flex items-start gap-2 text-sm px-2 py-1 rounded ${cfg.bg} ${cfg.text} border ${cfg.border}`}
            >
              <span className="font-bold shrink-0 w-4 text-center">{cfg.icon}</span>
              <span>
                <span className="font-medium">{check.label}</span>
                {check.detail && (
                  <span className="ml-1 opacity-80">— {check.detail}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Build a checks array from quote data.
 * Callers may spread nullable conditions into this array;
 * QuoteReadinessChecker.filter(Boolean) handles the undefined/false entries.
 */
export function buildQuoteChecks(params: {
  hasCustomer: boolean;
  hasPieces: boolean;
  allPiecesHaveMaterial: boolean;
  allPiecesHaveDimensions: boolean;
  hasPriceBook: boolean;
}): Array<ReadinessCheck | false> {
  const { hasCustomer, hasPieces, allPiecesHaveMaterial, allPiecesHaveDimensions, hasPriceBook } = params;

  return [
    {
      label: 'Customer assigned',
      status: hasCustomer ? 'pass' : 'fail',
      detail: hasCustomer ? undefined : 'Select a customer to apply pricing tier',
    } satisfies ReadinessCheck,

    {
      label: 'Pieces added',
      status: hasPieces ? 'pass' : 'fail',
      detail: hasPieces ? undefined : 'Add at least one piece to the quote',
    } satisfies ReadinessCheck,

    hasPieces && ({
      label: 'All pieces have a material',
      status: allPiecesHaveMaterial ? 'pass' : 'warn',
      detail: allPiecesHaveMaterial ? undefined : 'Some pieces are missing a material selection',
    } satisfies ReadinessCheck),

    hasPieces && ({
      label: 'All pieces have dimensions',
      status: allPiecesHaveDimensions ? 'pass' : 'fail',
      detail: allPiecesHaveDimensions ? undefined : 'Some pieces have zero length or width',
    } satisfies ReadinessCheck),

    hasPriceBook
      ? ({
          label: 'Price book assigned',
          status: 'pass',
        } satisfies ReadinessCheck)
      : ({
          label: 'Price book assigned',
          status: 'warn',
          detail: 'Using default pricing — assign a price book for accurate rates',
        } satisfies ReadinessCheck),
  ];
}
