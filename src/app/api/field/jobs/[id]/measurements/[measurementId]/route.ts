import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// PATCH - Update a measurement
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; measurementId: string }> }
) {
  try {
    const { id, measurementId } = await params;

    // Verify measurement exists and belongs to this job
    const existing = await prisma.fieldMeasurement.findFirst({
      where: { id: measurementId, jobId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Measurement not found' },
        { status: 404 }
      );
    }

    const data = await request.json();
    const { room, piece, length, width, thickness, finishedEdges, notes } = data;

    // Validate dimensions if provided
    if (length !== undefined && length <= 0) {
      return NextResponse.json(
        { error: 'Length must be positive' },
        { status: 400 }
      );
    }
    if (width !== undefined && width <= 0) {
      return NextResponse.json(
        { error: 'Width must be positive' },
        { status: 400 }
      );
    }

    const measurement = await prisma.fieldMeasurement.update({
      where: { id: measurementId },
      data: {
        room: room !== undefined ? room : existing.room,
        piece: piece !== undefined ? piece : existing.piece,
        lengthMm: length !== undefined ? length : existing.lengthMm,
        widthMm: width !== undefined ? width : existing.widthMm,
        thicknessMm: thickness !== undefined ? thickness : existing.thicknessMm,
        finishedEdges:
          finishedEdges !== undefined ? finishedEdges : existing.finishedEdges,
        notes: notes !== undefined ? notes : existing.notes,
      },
    });

    return NextResponse.json(measurement);
  } catch (error) {
    console.error('Error updating measurement:', error);
    return NextResponse.json(
      { error: 'Failed to update measurement' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a measurement
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; measurementId: string }> }
) {
  try {
    const { id, measurementId } = await params;

    // Verify measurement exists and belongs to this job
    const existing = await prisma.fieldMeasurement.findFirst({
      where: { id: measurementId, jobId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Measurement not found' },
        { status: 404 }
      );
    }

    await prisma.fieldMeasurement.delete({
      where: { id: measurementId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting measurement:', error);
    return NextResponse.json(
      { error: 'Failed to delete measurement' },
      { status: 500 }
    );
  }
}
