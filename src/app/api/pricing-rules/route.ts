import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const rules = await prisma.pricingRule.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json(rules);
  } catch (error) {
    console.error('Error fetching pricing rules:', error);
    return NextResponse.json({ error: 'Failed to fetch pricing rules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const rule = await prisma.pricingRule.create({
      data: {
        category: data.category,
        name: data.name,
        description: data.description || null,
        price: data.price,
        priceType: data.priceType,
        isActive: true,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('Error creating pricing rule:', error);
    return NextResponse.json({ error: 'Failed to create pricing rule' }, { status: 500 });
  }
}
