import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const jobId = parseInt(id, 10);

    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    const body = await request.json();
    const { notes } = body;

    if (typeof notes !== 'string') {
      return NextResponse.json({ error: 'Notes must be a string' }, { status: 400 });
    }

    const job = await prisma.fieldJob.update({
      where: { id: jobId },
      data: { notes },
      select: { id: true, notes: true, updatedAt: true },
    });

    return NextResponse.json(job);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    console.error('Failed to update notes:', error);
    return NextResponse.json({ error: 'Failed to update notes' }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const jobId = parseInt(id, 10);

    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    const job = await prisma.fieldJob.findUnique({
      where: { id: jobId },
      select: { id: true, notes: true, updatedAt: true },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error('Failed to fetch notes:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}
