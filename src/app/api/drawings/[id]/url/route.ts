import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/db';
import { getSignedDownloadUrl } from '@/lib/storage/r2';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use QuoteFile model - filePath stores the R2 storage key
    const quoteFile = await prisma.quoteFile.findUnique({
      where: { id: parseInt(params.id, 10) },
      select: { filePath: true },
    });

    if (!quoteFile) {
      return NextResponse.json({ error: 'Drawing not found' }, { status: 404 });
    }

    const signedUrl = await getSignedDownloadUrl(quoteFile.filePath);

    return NextResponse.json({ url: signedUrl });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate URL' },
      { status: 500 }
    );
  }
}
