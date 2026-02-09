import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getXeroAuthUrl } from '@/lib/services/xero-auth-manager';

/**
 * GET /api/auth/xero/login
 *
 * Initiates the Xero OAuth 2.0 flow. The authenticated user is redirected
 * to Xero's consent screen. On approval, Xero redirects back to
 * /api/auth/xero/callback with an authorization code.
 *
 * Query params:
 *   - matter_reference (optional): link this connection to an insolvency matter
 */
export async function GET(request: NextRequest) {
  try {
    // Require the user to be logged in (ADMIN or SALES_MANAGER can connect)
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

    const authUrl = await getXeroAuthUrl({
      userId: user.id,
      companyId: user.companyId,
      matterReference,
    });

    // Redirect the browser to Xero's consent page
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Xero login initiation error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to initiate Xero connection',
      },
      { status: 500 }
    );
  }
}
