import { NextRequest, NextResponse } from 'next/server';
import { getDownloadUrl } from '@/lib/storage/r2';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * GET /api/drawings/test-presigned?key=drawings/1/2/test.pdf
 * Test presigned URL generation (diagnostic endpoint)
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  
  if (!key) {
    return NextResponse.json({ 
      error: 'Missing key parameter',
      usage: '/api/drawings/test-presigned?key=drawings/1/2/test.pdf'
    }, { status: 400 });
  }

  const diagnostics: any = {
    inputKey: key,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    r2Config: {
      hasAccountId: !!process.env.R2_ACCOUNT_ID,
      hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY,
      bucketName: process.env.R2_BUCKET_NAME || 'stonehenge-drawings',
      accountId: process.env.R2_ACCOUNT_ID ? 
        process.env.R2_ACCOUNT_ID.substring(0, 8) + '...' : 'missing',
    },
  };

  // Try method 1: Using our library function
  try {
    console.log('[Test] Attempting getDownloadUrl with key:', key);
    const url = await getDownloadUrl(key);
    diagnostics.method1_libraryFunction = {
      success: true,
      url: url.substring(0, 100) + '...',
      urlLength: url.length,
    };
  } catch (error) {
    diagnostics.method1_libraryFunction = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Try method 2: Direct AWS SDK call
  try {
    const endpoint = process.env.R2_ENDPOINT || 
      `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    
    const client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || 'stonehenge-drawings',
      Key: key,
    });

    const url = await getSignedUrl(client, command, { expiresIn: 3600 });
    
    diagnostics.method2_directSDK = {
      success: true,
      endpoint,
      url: url.substring(0, 100) + '...',
      urlLength: url.length,
      urlHost: new URL(url).host,
    };
  } catch (error) {
    diagnostics.method2_directSDK = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorDetails: error instanceof Error ? error.stack : undefined,
    };
  }

  return NextResponse.json(diagnostics, { status: 200 });
}

export const dynamic = 'force-dynamic';
