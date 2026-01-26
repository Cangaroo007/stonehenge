import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientTypeId = searchParams.get('clientTypeId');
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    // Note: Tiers are universal across all client types in the current schema
    // The clientTypeId param is accepted for API consistency but doesn't filter
    const clientTiers = await prisma.clientTier.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { priority: 'desc' }],
    });
    return NextResponse.json(clientTiers);
  } catch (error) {
    console.error('Error fetching client tiers:', error);
    return NextResponse.json({ error: 'Failed to fetch client tiers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const clientTier = await prisma.clientTier.create({
      data: {
        name: data.name,
        description: data.description || null,
        priority: data.priority || 0,
        isDefault: data.isDefault || false,
        sortOrder: data.sortOrder || 0,
        isActive: data.isActive ?? true,
      },
    });

    return NextResponse.json(clientTier, { status: 201 });
  } catch (error) {
    console.error('Error creating client tier:', error);
    return NextResponse.json({ error: 'Failed to create client tier' }, { status: 500 });
  }
}
