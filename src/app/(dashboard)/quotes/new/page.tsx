import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { generateQuoteNumber } from '@/lib/utils';
import QuoteForm from '@/components/QuoteForm';

export const dynamic = 'force-dynamic';

async function getData() {
  const [customers, materials, pricingRules, lastQuote] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: 'asc' } }),
    prisma.material.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.featurePricing.findMany({ where: { isActive: true }, orderBy: { category: 'asc' } }),
    prisma.quote.findFirst({ orderBy: { quoteNumber: 'desc' } }),
  ]);

  const nextQuoteNumber = generateQuoteNumber(lastQuote?.quoteNumber || null);

  const serialized = JSON.parse(JSON.stringify({ customers, materials, pricingRules }));
  
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
        nextQuoteNumber={data.nextQuoteNumber}
        userId={user?.id}
      />
    </div>
  );
}
