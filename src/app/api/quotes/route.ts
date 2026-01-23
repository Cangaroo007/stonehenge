import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';

interface RoomData {
  name: string;
  sortOrder: number;
  pieces: PieceData[];
}

interface PieceData {
  description: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  materialId: number | null;
  materialName: string | null;
  areaSqm: number;
  materialCost: number;
  featuresCost: number;
  totalCost: number;
  sortOrder: number;
  features: FeatureData[];
}

interface FeatureData {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface DrawingAnalysisData {
  filename: string;
  analyzedAt: string;
  drawingType: string;
  rawResults: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
}

interface QuoteCreateData {
  quoteNumber: string;
  customerId: number | null;
  projectName: string | null;
  projectAddress: string | null;
  status?: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  createdBy: number | null;
  rooms: RoomData[];
  drawingAnalysis?: DrawingAnalysisData | null;
}

export async function GET() {
  try {
    const quotes = await prisma.quote.findMany({
      orderBy: { createdAt: 'desc' },
      include: { customer: true },
    });
    return NextResponse.json(quotes);
  } catch (error) {
    console.error('Error fetching quotes:', error);
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data: QuoteCreateData = await request.json();

    // Create the quote with rooms and pieces
    const quote = await prisma.quote.create({
      data: {
        quoteNumber: data.quoteNumber,
        customerId: data.customerId,
        projectName: data.projectName,
        projectAddress: data.projectAddress,
        status: data.status || 'draft',
        subtotal: data.subtotal,
        taxRate: data.taxRate,
        taxAmount: data.taxAmount,
        total: data.total,
        notes: data.notes,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        createdBy: data.createdBy,
        rooms: {
          create: data.rooms.map((room: RoomData) => ({
            name: room.name,
            sortOrder: room.sortOrder,
            pieces: {
              create: room.pieces.map((piece: PieceData) => ({
                description: piece.description,
                lengthMm: piece.lengthMm,
                widthMm: piece.widthMm,
                thicknessMm: piece.thicknessMm,
                materialId: piece.materialId,
                materialName: piece.materialName,
                areaSqm: piece.areaSqm,
                materialCost: piece.materialCost,
                featuresCost: piece.featuresCost,
                totalCost: piece.totalCost,
                sortOrder: piece.sortOrder,
                features: {
                  create: piece.features.map((feature: FeatureData) => ({
                    name: feature.name,
                    quantity: feature.quantity,
                    unitPrice: feature.unitPrice,
                    totalPrice: feature.totalPrice,
                  })),
                },
              })),
            },
          })),
        },
        // Create drawing analysis if provided
        ...(data.drawingAnalysis && {
          drawingAnalysis: {
            create: {
              filename: data.drawingAnalysis.filename,
              analyzedAt: new Date(data.drawingAnalysis.analyzedAt),
              drawingType: data.drawingAnalysis.drawingType,
              rawResults: data.drawingAnalysis.rawResults as Prisma.InputJsonValue,
              metadata: data.drawingAnalysis.metadata as Prisma.InputJsonValue,
              importedPieces: [],
            },
          },
        }),
      },
    });

    return NextResponse.json(quote, { status: 201 });
  } catch (error) {
    console.error('Error creating quote:', error);
    return NextResponse.json({ error: 'Failed to create quote' }, { status: 500 });
  }
}
