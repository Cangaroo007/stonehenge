import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createDrawing } from '@/lib/services/drawingService';

/**
 * POST /api/quotes/[id]/drawings
 * Create a drawing database record after successful R2 upload
 */
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

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { storageKey, filename, mimeType, fileSize, analysisData } = body;

    if (!storageKey || !filename || !mimeType) {
      return NextResponse.json(
        { error: 'Missing required fields: storageKey, filename, mimeType' },
        { status: 400 }
      );
    }

    // Get customerId from the quote
    const prisma = (await import('@/lib/db')).default;
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      select: { customerId: true },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (!quote.customerId) {
      return NextResponse.json(
        { error: 'Quote has no customer assigned' },
        { status: 400 }
      );
    }

    console.log('[Create Drawing] Creating database record:', {
      quoteId,
      customerId: quote.customerId,
      storageKey,
      filename,
    });

    const drawing = await createDrawing({
      filename,
      storageKey,
      mimeType,
      fileSize: fileSize || 0,
      quoteId,
      customerId: quote.customerId,
      analysisData,
      isPrimary: false,
    });

    console.log('[Create Drawing] ✅ Drawing record created:', drawing.id);

    return NextResponse.json(drawing);
  } catch (error) {
    console.error('[Create Drawing] ❌ Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create drawing record' },
      { status: 500 }
    );
  }
}
