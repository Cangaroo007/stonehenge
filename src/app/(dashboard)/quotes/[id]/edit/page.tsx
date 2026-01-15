import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import QuoteForm from '@/components/QuoteForm';

export const dynamic = 'force-dynamic';

async function getData(quoteId: number) {
  const [quote, customers, materials, pricingRules] = await Promise.all([
    prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        rooms: {
          orderBy: { sortOrder: 'asc' },
          include: {
            pieces: {
              orderBy: { sortOrder: 'asc' },
              include: { features: true },
            },
          },
        },
      },
    }),
    prisma.customer.findMany({ orderBy: { name: 'asc' } }),
    prisma.material.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.pricingRule.findMany({ where: { isActive: true }, orderBy: { category: 'asc' } }),
  ]);

  return { quote, customers, materials, pricingRules };
}

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quoteId = parseInt(id);
  
  const [data, user] = await Promise.all([
    getData(quoteId),
    getCurrentUser(),
  ]);

  if (!data.quote) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Edit {data.quote.quoteNumber}
        </h1>
      </div>

      <QuoteForm
        customers={data.customers}
        materials={data.materials}
        pricingRules={data.pricingRules}
        nextQuoteNumber={data.quote.quoteNumber}
        userId={user?.id}
        initialData={{
          id: data.quote.id,
          quoteNumber: data.quote.quoteNumber,
          customerId: data.quote.customerId,
          projectName: data.quote.projectName,
          projectAddress: data.quote.projectAddress,
          notes: data.quote.notes,
          rooms: data.quote.rooms.map((r) => ({
            id: r.id,
            name: r.name,
            pieces: r.pieces.map((p) => ({
              id: p.id,
              description: p.description,
              lengthMm: p.lengthMm,
              widthMm: p.widthMm,
              thicknessMm: p.thicknessMm,
              materialId: p.materialId,
              features: p.features.map((f) => ({
                id: f.id,
                name: f.name,
                quantity: f.quantity,
                unitPrice: f.unitPrice,
              })),
            })),
          })),
        }}
      />
    </div>
  );
}
