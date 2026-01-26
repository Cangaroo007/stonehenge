import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clientTier = await prisma.clientTier.findUnique({
      where: { id },
    });

    if (!clientTier) {
      return NextResponse.json({ error: 'Client tier not found' }, { status: 404 });
    }

    return NextResponse.json(clientTier);
  } catch (error) {
    console.error('Error fetching client tier:', error);
    return NextResponse.json({ error: 'Failed to fetch client tier' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();

    const clientTier = await prisma.clientTier.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description || null,
        priority: data.priority || 0,
        isDefault: data.isDefault || false,
        sortOrder: data.sortOrder || 0,
        isActive: data.isActive ?? true,
      },
    });

    return NextResponse.json(clientTier);
  } catch (error) {
    console.error('Error updating client tier:', error);
    return NextResponse.json({ error: 'Failed to update client tier' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Soft delete by setting isActive to false
    await prisma.clientTier.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting client tier:', error);
    return NextResponse.json({ error: 'Failed to delete client tier' }, { status: 500 });
  }
}
