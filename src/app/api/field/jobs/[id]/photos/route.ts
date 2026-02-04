import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getDownloadUrl } from '@/lib/storage/r2';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const job = await prisma.fieldJob.findFirst({
    where: { id, createdById: user.id },
    include: {
      photos: {
        orderBy: { takenAt: 'desc' },
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Generate presigned download URLs for each photo
  const photosWithUrls = await Promise.all(
    job.photos.map(async (photo) => ({
      id: photo.id,
      fileKey: photo.storageKey,
      filename: photo.filename,
      takenAt: photo.takenAt.toISOString(),
      url: await getDownloadUrl(photo.storageKey),
    }))
  );

  return NextResponse.json(photosWithUrls);
}
