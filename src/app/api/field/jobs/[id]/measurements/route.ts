import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET - List measurements for a field job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify the job exists
    const job = await prisma.fieldJob.findUnique({
      where: { id },
      select: { id: true, projectName: true, jobNumber: true },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const measurements = await prisma.fieldMeasurement.findMany({
      where: { jobId: id },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ job, measurements });
  } catch (error) {
    console.error('Error fetching measurements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch measurements' },
      { status: 500 }
    );
  }
}

// POST - Create a new measurement
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify the job exists
    const job = await prisma.fieldJob.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const data = await request.json();
    const { room, piece, length, width, thickness = 20, finishedEdges, notes } = data;

    // Validate required fields
    if (!length || !width || length <= 0 || width <= 0) {
      return NextResponse.json(
        { error: 'Length and width are required and must be positive' },
        { status: 400 }
      );
    }

    // Get next sort order
    const lastMeasurement = await prisma.fieldMeasurement.findFirst({
      where: { jobId: id },
      orderBy: { sortOrder: 'desc' },
    });

    const measurement = await prisma.fieldMeasurement.create({
      data: {
        jobId: id,
        room: room || null,
        piece: piece || null,
        lengthMm: length,
        widthMm: width,
        thicknessMm: thickness,
        finishedEdges: finishedEdges || null,
        notes: notes || null,
        sortOrder: (lastMeasurement?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json(measurement, { status: 201 });
  } catch (error) {
    console.error('Error creating measurement:', error);
    return NextResponse.json(
      { error: 'Failed to create measurement' },
      { status: 500 }
    );
  }
}
