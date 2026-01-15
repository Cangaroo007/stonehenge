import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const quote = await prisma.quote.findUnique({
      where: { id: parseInt(id) },
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
        files: true,
      },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    return NextResponse.json(quote);
  } catch (error) {
    console.error('Error fetching quote:', error);
    return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const quoteId = parseInt(id);
    const data = await request.json();

    // Delete existing rooms (cascade deletes pieces and features)
    await prisma.quoteRoom.deleteMany({
      where: { quoteId },
    });

    // Update quote with new rooms
    const quote = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        customerId: data.customerId,
        projectName: data.projectName,
        projectAddress: data.projectAddress,
        status: data.status,
        subtotal: data.subtotal,
        taxRate: data.taxRate,
        taxAmount: data.taxAmount,
        total: data.total,
        notes: data.notes,
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

    return NextResponse.json(quote);
  } catch (error) {
    console.error('Error updating quote:', error);
    return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.quote.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting quote:', error);
    return NextResponse.json({ error: 'Failed to delete quote' }, { status: 500 });
  }
}
