import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/utils';
import DeleteQuoteButton from '@/components/DeleteQuoteButton';

export const dynamic = 'force-dynamic';

async function getQuote(id: number) {
  return prisma.quote.findUnique({
    where: { id },
    include: {
      customer: true,
      rooms: {
        orderBy: { sortOrder: 'asc' },
        include: {
          pieces: {
            orderBy: { sortOrder: 'asc' },
            include: {
              features: true,
              material: true,
            },
          },
        },
      },
    },
  });
}

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await getQuote(parseInt(id));

  if (!quote) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{quote.quoteNumber}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(quote.status)}`}>
              {getStatusLabel(quote.status)}
            </span>
          </div>
          <p className="text-gray-500 mt-1">{quote.projectName}</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/quotes/${quote.id}/edit`} className="btn-secondary">
            Edit Quote
          </Link>
          <Link href={`/api/quotes/${quote.id}/pdf`} target="_blank" className="btn-primary">
            Download PDF
          </Link>
          <DeleteQuoteButton quoteId={quote.id} />
        </div>
      </div>

      {/* Quote Info */}
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500">Customer</p>
            <p className="font-medium">{quote.customer?.name || '-'}</p>
            {quote.customer?.company && (
              <p className="text-sm text-gray-500">{quote.customer.company}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">Project Address</p>
            <p className="font-medium">{quote.projectAddress || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Created</p>
            <p className="font-medium">{formatDate(quote.createdAt)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Valid Until</p>
            <p className="font-medium">{quote.validUntil ? formatDate(quote.validUntil) : '-'}</p>
          </div>
        </div>
      </div>

      {/* Rooms and Pieces */}
      <div className="space-y-4">
        {quote.rooms.map((room) => (
          <div key={room.id} className="card">
            <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
              <h3 className="text-lg font-semibold">{room.name}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Description</th>
                    <th className="table-header">Dimensions</th>
                    <th className="table-header">Material</th>
                    <th className="table-header">Features</th>
                    <th className="table-header text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {room.pieces.map((piece) => (
                    <tr key={piece.id}>
                      <td className="table-cell font-medium">
                        {piece.description || 'Unnamed piece'}
                      </td>
                      <td className="table-cell">
                        {piece.lengthMm} × {piece.widthMm} × {piece.thicknessMm}mm
                        <br />
                        <span className="text-xs text-gray-500">
                          ({Number(piece.areaSqm).toFixed(2)} m²)
                        </span>
                      </td>
                      <td className="table-cell">{piece.materialName || '-'}</td>
                      <td className="table-cell">
                        {piece.features.length > 0 ? (
                          <ul className="text-sm">
                            {piece.features.map((f) => (
                              <li key={f.id}>
                                {f.quantity}× {f.name}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="table-cell text-right font-medium">
                        {formatCurrency(Number(piece.totalCost))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Notes */}
      {quote.notes && (
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Notes</h3>
          <p className="text-gray-600 whitespace-pre-wrap">{quote.notes}</p>
        </div>
      )}

      {/* Totals */}
      <div className="card p-6">
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">{formatCurrency(Number(quote.subtotal))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">GST ({Number(quote.taxRate)}%):</span>
              <span className="font-medium">{formatCurrency(Number(quote.taxAmount))}</span>
            </div>
            <div className="flex justify-between text-lg border-t pt-2">
              <span className="font-semibold">Total:</span>
              <span className="font-bold text-primary-600">
                {formatCurrency(Number(quote.total))}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
