import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { uploadToR2, generateDrawingKey } from '@/lib/storage/r2';

export const runtime = 'nodejs';

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const customerId = formData.get('customerId') as string | null;
    const quoteId = formData.get('quoteId') as string | null;

    // Validation
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!customerId || !quoteId) {
      return NextResponse.json(
        { error: 'customerId and quoteId are required' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, PDF' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size: 10MB' },
        { status: 400 }
      );
    }

    // Convert to buffer and upload
    const buffer = Buffer.from(await file.arrayBuffer());
    const storageKey = generateDrawingKey(customerId, quoteId, file.name);

    const result = await uploadToR2(storageKey, buffer, file.type);

    return NextResponse.json({
      success: true,
      storageKey: result.key,
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
