import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { uploadToR2 } from '@/lib/storage/r2';
import { v4 as uuidv4 } from 'uuid';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

/**
 * POST /api/upload/drawing
 * Upload a drawing file to R2 storage
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const customerId = formData.get('customerId') as string | null;
    const quoteId = formData.get('quoteId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!customerId || !quoteId) {
      return NextResponse.json(
        { error: 'customerId and quoteId are required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PDF, PNG, JPG' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      );
    }

    // Generate a unique storage key
    const fileExtension = file.name.split('.').pop() || 'bin';
    const uniqueId = uuidv4();
    const storageKey = `drawings/${customerId}/${quoteId}/${uniqueId}.${fileExtension}`;

    // Get file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to R2
    await uploadToR2(storageKey, buffer, file.type);

    return NextResponse.json({
      storageKey,
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
    });
  } catch (error) {
    console.error('Error uploading drawing:', error);
    return NextResponse.json(
      { error: 'Failed to upload drawing' },
      { status: 500 }
    );
  }
}
