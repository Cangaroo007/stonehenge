import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import QuoteForm from '@/components/QuoteForm';

export const dynamic = 'force-dynamic';

interface RoomData {
  id: number;
  name: string;
  pieces: PieceData[];
}

interface PieceData {
  id: number;
  description: string | null;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  materialId: number | null;
  features: FeatureData[];
}

interface FeatureData {
  id: number;
  name: string;
  quantity: number;
  unitPrice: string | number;
}

interface AnalysisMetadata {
  jobNumber?: string | null;
  defaultThickness?: number;
  defaultOverhang?: number;
}

interface AnalysisPiece {
  pieceNumber?: number;
  name: string;
  shape?: string;
  length: number;
  width: number;
  thickness: number;
  cutouts?: Array<{ type: string; notes?: string }>;
  notes?: string;
  confidence: number;
}

interface AnalysisRoom {
  name: string;
  pieces: AnalysisPiece[];
}

interface AnalysisResult {
  success: boolean;
  drawingType?: 'cad_professional' | 'job_sheet' | 'hand_drawn' | 'architectural';
  metadata?: AnalysisMetadata;
  rooms: AnalysisRoom[];
  warnings?: string[];
  questionsForUser?: string[];
}

interface DrawingAnalysisData {
  id: number;
  filename: string;
  analyzedAt: string;
  drawingType: string;
  rawResults: AnalysisResult;
  metadata: AnalysisMetadata | null;
}

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
        drawingAnalysis: true,
      },
    }),
    prisma.customer.findMany({ orderBy: { name: 'asc' } }),
    prisma.material.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.pricingRule.findMany({ where: { isActive: true }, orderBy: { category: 'asc' } }),
  ]);

  return JSON.parse(JSON.stringify({ quote, customers, materials, pricingRules }));
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

  // Prepare drawing analysis for the form if it exists
  const drawingAnalysis: DrawingAnalysisData | null = data.quote.drawingAnalysis
    ? {
        id: data.quote.drawingAnalysis.id,
        filename: data.quote.drawingAnalysis.filename,
        analyzedAt: data.quote.drawingAnalysis.analyzedAt,
        drawingType: data.quote.drawingAnalysis.drawingType,
        rawResults: data.quote.drawingAnalysis.rawResults,
        metadata: data.quote.drawingAnalysis.metadata,
      }
    : null;

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
          rooms: data.quote.rooms.map((r: RoomData) => ({
            id: r.id,
            name: r.name,
            pieces: r.pieces.map((p: PieceData) => ({
              id: p.id,
              description: p.description,
              lengthMm: p.lengthMm,
              widthMm: p.widthMm,
              thicknessMm: p.thicknessMm,
              materialId: p.materialId,
              features: p.features.map((f: FeatureData) => ({
                id: f.id,
                name: f.name,
                quantity: f.quantity,
                unitPrice: f.unitPrice,
              })),
            })),
          })),
          drawingAnalysis,
        }}
      />
    </div>
  );
}
