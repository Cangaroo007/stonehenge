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
    // TODO: Replace with actual R2 presigned URL when implemented
    // For now, return a placeholder that indicates the drawing exists
    try {
      const url = await getDownloadUrl(drawing.storageKey);
      return NextResponse.json({ url });
    } catch {
      // R2 not yet implemented - return a placeholder response
      // The frontend will show an error state
      return NextResponse.json({
        url: null,
        placeholder: true,
        message: 'R2 storage not yet configured',
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
