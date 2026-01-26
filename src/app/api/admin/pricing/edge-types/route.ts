import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const edgeTypes = await prisma.edgeType.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json(edgeTypes);
  } catch (error) {
    console.error('Error fetching edge types:', error);
    return NextResponse.json({ error: 'Failed to fetch edge types' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const edgeType = await prisma.edgeType.create({
      data: {
        name: data.name,
        description: data.description || null,
        category: data.category || 'polish',
        baseRate: data.baseRate || 0,
        sortOrder: data.sortOrder || 0,
        isActive: data.isActive ?? true,
      },
    });

    return NextResponse.json(edgeType, { status: 201 });
  } catch (error) {
    console.error('Error creating edge type:', error);
    return NextResponse.json({ error: 'Failed to create edge type' }, { status: 500 });
  }
}
