import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission, Permission } from '@/lib/permissions';
import { getDownloadUrl } from '@/lib/storage/r2';
import prisma from '@/lib/db';

/**
 * GET /api/drawings/[id]/url
 * Get a presigned URL for viewing a drawing
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the drawing
    const drawing = await prisma.drawing.findUnique({
      where: { id },
      include: {
        quote: {
          select: {
            id: true,
            customerId: true,
            createdBy: true,
          },
        },
      },
    });

    if (!drawing) {
      return NextResponse.json({ error: 'Drawing not found' }, { status: 404 });
    }

    // Check access permissions
    const canViewAll = await hasPermission(
      currentUser.id,
      Permission.VIEW_ALL_QUOTES
    );

    const hasAccess =
      canViewAll ||
      drawing.quote.createdBy === currentUser.id ||
      (currentUser.customerId && drawing.quote.customerId === currentUser.customerId);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generate presigned URL
    console.log('[Drawing URL API] Generating presigned URL for drawing:', {
      drawingId: drawing.id,
      filename: drawing.filename,
      storageKey: drawing.storageKey,
      quoteId: drawing.quoteId
    });

    try {
      const url = await getDownloadUrl(drawing.storageKey);
      console.log('[Drawing URL API] ✅ Presigned URL generated successfully');
      return NextResponse.json({ url });
    } catch (error) {
      // R2 error - log details and return placeholder response
      console.error('[Drawing URL API] ❌ Failed to generate presigned URL:', {
        error: error instanceof Error ? error.message : String(error),
        storageKey: drawing.storageKey,
        drawingId: drawing.id
      });
      
      return NextResponse.json({
        url: null,
        placeholder: true,
        message: error instanceof Error ? error.message : 'R2 storage error',
        error: 'Failed to generate presigned URL'
      });
    }
  } catch (error) {
    console.error('Error getting drawing URL:', error);
    return NextResponse.json(
      { error: 'Failed to get drawing URL' },
      { status: 500 }
    );
  }
}
