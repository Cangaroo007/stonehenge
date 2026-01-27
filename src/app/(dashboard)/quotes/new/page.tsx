import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { generateQuoteNumber } from '@/lib/utils';
import QuoteForm from '@/components/QuoteForm';

export const dynamic = 'force-dynamic';

async function getData() {
  // Fetch ALL edge types first (for debugging), then filter
  const allEdgeTypes = await prisma.edgeType.findMany({ orderBy: { sortOrder: 'asc' } });
  console.log('[quotes/new] ALL edgeTypes in DB:', allEdgeTypes.length, allEdgeTypes.map(e => ({ id: e.id, name: e.name, isActive: e.isActive })));

  const [customers, materials, pricingRules, lastQuote] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: 'asc' } }),
    prisma.material.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.featurePricing.findMany({ where: { isActive: true }, orderBy: { category: 'asc' } }),
    prisma.quote.findFirst({ orderBy: { quoteNumber: 'desc' } }),
  ]);

  // Use all edge types (not filtered by isActive) to ensure they show up
  // The EdgeSelector component will handle filtering if needed
  const edgeTypes = allEdgeTypes;

  const nextQuoteNumber = generateQuoteNumber(lastQuote?.quoteNumber || null);

  const serialized = JSON.parse(JSON.stringify({ customers, materials, pricingRules, edgeTypes }));
  console.log('[quotes/new] Serialized edgeTypes:', serialized.edgeTypes?.length);

  return { ...serialized, nextQuoteNumber };
}

export default async function NewQuotePage() {
  const [data, user] = await Promise.all([getData(), getCurrentUser()]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">New Quote</h1>
      </div>

      <QuoteForm
        customers={data.customers}
        materials={data.materials}
        pricingRules={data.pricingRules}
        edgeTypes={data.edgeTypes}
        nextQuoteNumber={data.nextQuoteNumber}
        userId={user?.id}
      />
    </div>
  );
}
