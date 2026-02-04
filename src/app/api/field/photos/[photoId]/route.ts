import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { deleteFromR2 } from '@/lib/storage/r2';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { photoId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // Find the photo and verify ownership through the field job
  const photo = await prisma.fieldPhoto.findUnique({
    where: { id: photoId },
    include: {
      fieldJob: {
        select: { createdById: true },
      },
    },
  });

  if (!photo) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (photo.fieldJob.createdById !== user.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 403 });
  }

  // Delete from R2 storage
  await deleteFromR2(photo.storageKey);

  // Delete from database
  await prisma.fieldPhoto.delete({
    where: { id: photoId },
  });

  return NextResponse.json({ success: true });
}
