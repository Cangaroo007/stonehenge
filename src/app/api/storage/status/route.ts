import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isR2Configured } from '@/lib/storage/r2';

/**
 * GET /api/storage/status
 * Diagnostic endpoint to check R2 storage configuration.
 * Only accessible to authenticated users.
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configured = isR2Configured();

    const hasAccountId = !!(process.env.R2_ACCOUNT_ID || process.env.R2_ENDPOINT);
    const hasAccessKey = !!process.env.R2_ACCESS_KEY_ID;
    const hasSecretKey = !!process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME || 'stonehenge-drawings';
    const nodeEnv = process.env.NODE_ENV;

    console.log('[Storage Status] R2 configuration check:', {
      configured,
      hasAccountId,
      hasAccessKey,
      hasSecretKey,
      bucketName,
      nodeEnv,
    });

    return NextResponse.json({
      configured,
      environment: nodeEnv,
      credentials: {
        accountId: hasAccountId ? 'set' : 'MISSING',
        accessKeyId: hasAccessKey ? 'set' : 'MISSING',
        secretAccessKey: hasSecretKey ? 'set' : 'MISSING',
      },
      bucketName,
      message: configured
        ? 'R2 storage is configured and ready'
        : 'R2 storage is NOT configured — uploads will fail in production',
    });
  } catch (error) {
    console.error('[Storage Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check storage status' },
      { status: 500 }
    );
  }
}
