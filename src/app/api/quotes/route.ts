import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

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
    const data = await request.json();

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
          create: data.rooms.map((room: any) => ({
            name: room.name,
            sortOrder: room.sortOrder,
            pieces: {
              create: room.pieces.map((piece: any) => ({
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
                  create: piece.features.map((feature: any) => ({
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
      },
    });

    return NextResponse.json(quote, { status: 201 });
  } catch (error) {
    console.error('Error creating quote:', error);
    return NextResponse.json({ error: 'Failed to create quote' }, { status: 500 });
  }
}
