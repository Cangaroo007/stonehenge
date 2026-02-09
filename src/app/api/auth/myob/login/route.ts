import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getMyobAuthUrl } from '@/lib/services/myob-auth-manager';

/**
 * GET /api/auth/myob/login
 *
 * Initiates the MYOB OAuth 2.0 flow. The authenticated user is redirected
 * to MYOB's consent screen.
 *
 * Query params:
 *   - matter_reference (optional): link this connection to an insolvency matter
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(['ADMIN', 'SALES_MANAGER']);

    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const matterReference =
      request.nextUrl.searchParams.get('matter_reference') ?? undefined;

    const authUrl = getMyobAuthUrl({
      userId: user.id,
      companyId: user.companyId,
      matterReference,
    });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('MYOB login initiation error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to initiate MYOB connection',
      },
      { status: 500 }
    );
  }
}
