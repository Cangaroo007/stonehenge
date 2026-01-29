import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/admin/pricing/service-rates/[id] - Get single service rate
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request, ['ADMIN', 'SALES_MANAGER']);
    
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid service rate ID' },
        { status: 400 }
      );
    }
    
    const rate = await prisma.serviceRate.findUnique({
      where: { id }
    });
    
    if (!rate) {
      return NextResponse.json(
        { error: 'Service rate not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(rate);
  } catch (error: any) {
    console.error('Error fetching service rate:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch service rate' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/pricing/service-rates/[id] - Update service rate
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request, ['ADMIN']);
    
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid service rate ID' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    
    const rate = await prisma.serviceRate.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.rate20mm !== undefined && { rate20mm: body.rate20mm }),
        ...(body.rate40mm !== undefined && { rate40mm: body.rate40mm }),
        ...(body.unit !== undefined && { unit: body.unit }),
        ...(body.minimumCharge !== undefined && { minimumCharge: body.minimumCharge }),
        ...(body.minimumQty !== undefined && { minimumQty: body.minimumQty }),
        ...(body.isActive !== undefined && { isActive: body.isActive })
      }
    });
    
    return NextResponse.json(rate);
  } catch (error: any) {
    console.error('Error updating service rate:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update service rate' },
      { status: 400 }
    );
  }
}

// DELETE /api/admin/pricing/service-rates/[id] - Delete service rate
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request, ['ADMIN']);
    
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid service rate ID' },
        { status: 400 }
      );
    }
    
    await prisma.serviceRate.delete({
      where: { id }
    });
    
    return NextResponse.json({ success: true, message: 'Service rate deleted' });
  } catch (error: any) {
    console.error('Error deleting service rate:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete service rate' },
      { status: 400 }
    );
  }
}
