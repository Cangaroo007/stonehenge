import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuthLegacy as requireAuth } from '@/lib/auth';

// GET /api/admin/pricing/service-rates - List all service rates
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, ['ADMIN', 'SALES_MANAGER']);
    
    const rates = await prisma.serviceRate.findMany({
      orderBy: { serviceType: 'asc' }
    });
    
    return NextResponse.json(rates);
  } catch (error: any) {
    console.error('Error fetching service rates:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch service rates' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

// POST /api/admin/pricing/service-rates - Create new service rate
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request, ['ADMIN']);
    
    const body = await request.json();
    
    // Validate required fields
    if (!body.serviceType || !body.name || !body.rate20mm || !body.rate40mm || !body.unit) {
      return NextResponse.json(
        { error: 'Missing required fields: serviceType, name, rate20mm, rate40mm, unit' },
        { status: 400 }
      );
    }
    
    const rate = await prisma.serviceRate.create({
      data: {
        serviceType: body.serviceType,
        name: body.name,
        description: body.description || null,
        rate20mm: body.rate20mm,
        rate40mm: body.rate40mm,
        unit: body.unit,
        minimumCharge: body.minimumCharge || null,
        minimumQty: body.minimumQty || null,
        isActive: body.isActive !== undefined ? body.isActive : true
      }
    });
    
    return NextResponse.json(rate, { status: 201 });
  } catch (error: any) {
    console.error('Error creating service rate:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create service rate' },
      { status: 400 }
    );
  }
}
