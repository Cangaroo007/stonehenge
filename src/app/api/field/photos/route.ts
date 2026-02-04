import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { uploadToR2 } from '@/lib/storage/r2';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if ('error' in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const userId = authResult.user.id;
  const companyId = authResult.user.companyId;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const jobId = formData.get('jobId') as string | null;
    const gpsLat = formData.get('gpsLat') as string | null;
    const gpsLng = formData.get('gpsLng') as string | null;

    if (!file || !jobId) {
      return NextResponse.json(
        { error: 'Missing file or jobId' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Accepted: JPEG, PNG, WebP, HEIC' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10 MB' },
        { status: 400 }
      );
    }

    // Verify job belongs to user's company and was created by user
    const job = await prisma.fieldJob.findFirst({
      where: { id: jobId, createdBy: userId, companyId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Generate unique key
    const timestamp = Date.now();
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${timestamp}.${ext}`;
    const fileKey = `field-photos/${jobId}/${filename}`;

    // Upload to R2
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadToR2(fileKey, buffer, file.type);

    // Create database record
    const photo = await prisma.fieldPhoto.create({
      data: {
        fieldJobId: jobId,
        fileKey,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        gpsLat: gpsLat ? parseFloat(gpsLat) : null,
        gpsLng: gpsLng ? parseFloat(gpsLng) : null,
      },
    });

    // Update job's updatedAt
    await prisma.fieldJob.update({
      where: { id: jobId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    console.error('Photo upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload photo' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if ('error' in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json(
      { error: 'Missing jobId parameter' },
      { status: 400 }
    );
  }

  // Verify job belongs to user
  const job = await prisma.fieldJob.findFirst({
    where: {
      id: jobId,
      createdBy: authResult.user.id,
      companyId: authResult.user.companyId,
    },
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const photos = await prisma.fieldPhoto.findMany({
    where: { fieldJobId: jobId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(photos);
}
