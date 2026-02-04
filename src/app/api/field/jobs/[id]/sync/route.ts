import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { generateQuoteNumber } from '@/lib/utils';
import { calculateArea } from '@/lib/utils';
import { createInitialVersion } from '@/lib/services/quote-version-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const userId = authResult.user.id;

    const { id } = await params;
    const fieldJobId = parseInt(id, 10);
    if (isNaN(fieldJobId)) {
      return NextResponse.json({ error: 'Invalid field job ID' }, { status: 400 });
    }

    // Fetch field job with measurements
    const fieldJob = await prisma.fieldJob.findUnique({
      where: { id: fieldJobId },
      include: {
        measurements: { orderBy: { sortOrder: 'asc' } },
        customer: true,
      },
    });

    if (!fieldJob) {
      return NextResponse.json({ error: 'Field job not found' }, { status: 404 });
    }

    if (fieldJob.status === 'CONVERTED' && fieldJob.quoteId) {
      return NextResponse.json({
        error: 'Field job already converted',
        quoteId: fieldJob.quoteId,
      }, { status: 409 });
    }

    if (fieldJob.status !== 'READY_FOR_QUOTE') {
      return NextResponse.json({
        error: 'Field job must be in READY_FOR_QUOTE status to sync',
      }, { status: 400 });
    }

    if (fieldJob.measurements.length === 0) {
      return NextResponse.json({
        error: 'Field job has no measurements to convert',
      }, { status: 400 });
    }

    // Generate next quote number
    const lastQuote = await prisma.quote.findFirst({
      orderBy: { quoteNumber: 'desc' },
    });
    const quoteNumber = generateQuoteNumber(lastQuote?.quoteNumber || null);

    // Group measurements by room
    const roomMap = new Map<string, typeof fieldJob.measurements>();
    for (const m of fieldJob.measurements) {
      const room = m.room || 'General';
      if (!roomMap.has(room)) {
        roomMap.set(room, []);
      }
      roomMap.get(room)!.push(m);
    }

    // Create quote with rooms and pieces in a transaction
    const quote = await prisma.$transaction(async (tx) => {
      const newQuote = await tx.quote.create({
        data: {
          quoteNumber,
          customerId: fieldJob.customerId,
          projectName: fieldJob.projectName,
          projectAddress: fieldJob.projectAddress,
          status: 'draft',
          createdBy: userId,
          notes: fieldJob.notes,
          internalNotes: `Created from Field Job #${fieldJob.id}`,
          rooms: {
            create: Array.from(roomMap.entries()).map(([roomName, measurements], roomIndex) => ({
              name: roomName,
              sortOrder: roomIndex,
              pieces: {
                create: measurements.map((m, pieceIndex) => {
                  const areaSqm = calculateArea(m.lengthMm, m.widthMm);
                  return {
                    name: m.label,
                    description: [m.description, m.edgeNotes, m.cutoutNotes, m.materialNote]
                      .filter(Boolean)
                      .join(' | ') || null,
                    lengthMm: m.lengthMm,
                    widthMm: m.widthMm,
                    thicknessMm: m.thicknessMm,
                    areaSqm,
                    sortOrder: pieceIndex,
                  };
                }),
              },
            })),
          },
        },
        include: {
          rooms: {
            include: {
              pieces: true,
            },
          },
          customer: true,
        },
      });

      // Update field job status and link to quote
      await tx.fieldJob.update({
        where: { id: fieldJobId },
        data: {
          status: 'CONVERTED',
          quoteId: newQuote.id,
        },
      });

      return newQuote;
    });

    // Create initial version for version history (non-blocking)
    try {
      await createInitialVersion(quote.id, userId);
    } catch (versionError) {
      console.error('Error creating initial version (non-blocking):', versionError);
    }

    return NextResponse.json({
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      roomCount: quote.rooms.length,
      pieceCount: quote.rooms.reduce((sum, r) => sum + r.pieces.length, 0),
    }, { status: 201 });
  } catch (error) {
    console.error('Error syncing field job to quote:', error);
    return NextResponse.json(
      { error: 'Failed to create quote from field job' },
      { status: 500 }
    );
  }
}
