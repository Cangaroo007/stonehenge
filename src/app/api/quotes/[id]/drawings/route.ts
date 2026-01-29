import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission, Permission } from '@/lib/permissions';
import { getDrawingsForQuote, createDrawing } from '@/lib/services/drawingService';
import prisma from '@/lib/db';

/**
 * GET /api/quotes/[id]/drawings
 * Get all drawings for a quote
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

    const quoteId = parseInt(id);
    if (isNaN(quoteId)) {
      return NextResponse.json({ error: 'Invalid quote ID' }, { status: 400 });
    }

    // Check if user can view this quote
    const canViewAll = await hasPermission(
      currentUser.id,
      Permission.VIEW_ALL_QUOTES
    );

    // Get the quote to check ownership
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        customerId: true,
        createdBy: true,
      },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Check access
    const hasAccess =
      canViewAll ||
      quote.createdBy === currentUser.id ||
      (currentUser.customerId && quote.customerId === currentUser.customerId);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const drawings = await getDrawingsForQuote(quoteId);
    return NextResponse.json(drawings);
  } catch (error) {
    console.error('Error fetching drawings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drawings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/quotes/[id]/drawings
 * Create a new drawing record for a quote
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quoteId = parseInt(id);
    if (isNaN(quoteId)) {
      return NextResponse.json({ error: 'Invalid quote ID' }, { status: 400 });
    }

    // Get the quote to find customerId and check access
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      select: {
        customerId: true,
        createdBy: true,
      },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Check if user can edit this quote
    const canEdit = await hasPermission(
      currentUser.id,
      Permission.EDIT_QUOTES
    );
    const hasAccess =
      canEdit ||
      quote.createdBy === currentUser.id ||
      (currentUser.customerId && quote.customerId === currentUser.customerId);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { filename, storageKey, mimeType, fileSize, analysisData } = body;

    // Validate required fields
    if (!filename || !storageKey || !mimeType) {
      return NextResponse.json(
        { error: 'Missing required fields: filename, storageKey, mimeType' },
        { status: 400 }
      );
    }

    // Check if this is the first drawing (make it primary)
    const existingDrawings = await getDrawingsForQuote(quoteId);
    const isPrimary = existingDrawings.length === 0;

    const drawing = await createDrawing({
      filename,
      storageKey,
      mimeType,
      fileSize: fileSize || 0,
      quoteId,
      customerId: quote.customerId ?? 0,
      analysisData,
      isPrimary,
    });

    return NextResponse.json(drawing, { status: 201 });
  } catch (error) {
    console.error('Error saving drawing:', error);
    return NextResponse.json(
      { error: 'Failed to save drawing' },
      { status: 500 }
    );
  }
}
