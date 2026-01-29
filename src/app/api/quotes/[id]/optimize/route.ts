import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { optimizeSlabs } from '@/lib/services/slab-optimizer';

// GET - Retrieve saved optimization for quote
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const quoteId = parseInt(id, 10);

    if (isNaN(quoteId)) {
      return NextResponse.json({ error: 'Invalid quote ID' }, { status: 400 });
    }

    const optimization = await prisma.slabOptimization.findFirst({
      where: { quoteId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(optimization);
  } catch (error) {
    console.error('Failed to fetch optimization:', error);
    return NextResponse.json(
      { error: 'Failed to fetch optimization' },
      { status: 500 }
    );
  }
}

// POST - Run optimization and save
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const quoteId = parseInt(id, 10);

    if (isNaN(quoteId)) {
      return NextResponse.json({ error: 'Invalid quote ID' }, { status: 400 });
    }

    const body = await request.json();
    const { slabWidth = 3000, slabHeight = 1400, kerfWidth = 3, allowRotation = true } = body;

    // Get quote with pieces
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        rooms: {
          include: {
            pieces: true,
          },
        },
      },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Extract pieces from quote with thickness and finished edges
    const pieces = quote.rooms.flatMap((room: { 
      name: string; 
      pieces: Array<{ 
        id: number; 
        lengthMm: number; 
        widthMm: number; 
        thicknessMm: number;
        name: string;
        edgeTop: string | null;
        edgeBottom: string | null;
        edgeLeft: string | null;
        edgeRight: string | null;
      }> 
    }) =>
      room.pieces.map((piece) => ({
        id: piece.id.toString(),
        width: piece.lengthMm,
        height: piece.widthMm,
        label: `${room.name}: ${piece.name || 'Piece'}`,
        thickness: piece.thicknessMm || 20,
        finishedEdges: {
          top: piece.edgeTop !== null,
          bottom: piece.edgeBottom !== null,
          left: piece.edgeLeft !== null,
          right: piece.edgeRight !== null,
        },
      }))
    );

    if (pieces.length === 0) {
      return NextResponse.json(
        { error: 'Quote has no pieces to optimize' },
        { status: 400 }
      );
    }

    // Run optimization
    const result = optimizeSlabs({
      pieces,
      slabWidth,
      slabHeight,
      kerfWidth,
      allowRotation,
    });

    // Save to database
    const optimization = await prisma.slabOptimization.create({
      data: {
        quoteId,
        slabWidth,
        slabHeight,
        kerfWidth,
        totalSlabs: result.totalSlabs,
        totalWaste: result.totalWasteArea,
        wastePercent: result.wastePercent,
        placements: result.placements as object,
        laminationSummary: result.laminationSummary as object || null,
      },
    });

    return NextResponse.json({
      optimization,
      result,
    });
  } catch (error) {
    console.error('Failed to optimize:', error);
    return NextResponse.json(
      { error: 'Optimization failed' },
      { status: 500 }
    );
  }
}
