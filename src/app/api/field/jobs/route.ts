import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET: List jobs for current user
export async function GET() {
  const authResult = await requireAuth();
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const userId = authResult.user.id;

  const jobs = await prisma.fieldJob.findMany({
    where: { createdBy: userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: { photos: true, measurements: true },
      },
    },
  });

  return NextResponse.json(jobs);
}

// POST: Create new job
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const userId = authResult.user.id;

  const body = await request.json();
  const { customerName, siteAddress, contactPhone } = body;

  if (!customerName || typeof customerName !== 'string' || customerName.trim().length === 0) {
    return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
  }

  const job = await prisma.fieldJob.create({
    data: {
      customerName: customerName.trim(),
      siteAddress: siteAddress?.trim() || null,
      contactPhone: contactPhone?.trim() || null,
      createdBy: userId,
    },
  });

  return NextResponse.json(job, { status: 201 });
}
