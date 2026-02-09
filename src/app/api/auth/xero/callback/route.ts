import { NextRequest, NextResponse } from 'next/server';
import { handleXeroCallback } from '@/lib/services/xero-auth-manager';

/**
 * GET /api/auth/xero/callback
 *
 * Xero redirects here after the user approves (or denies) the consent request.
 * We exchange the authorization code for tokens, store them encrypted,
 * and redirect the user back to the dashboard connections page.
 *
 * Query params (set by Xero):
 *   - code:  authorization code
 *   - state: our base64url-encoded state blob (userId, companyId, etc.)
 *   - error: present if user denied consent
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const error = searchParams.get('error');
  if (error) {
    const errorDescription =
      searchParams.get('error_description') ?? 'User denied consent';
    console.warn('Xero OAuth denied:', error, errorDescription);

    // Redirect to dashboard with error message
    const redirectUrl = new URL('/dashboard/connections', request.url);
    redirectUrl.searchParams.set('error', `Xero: ${errorDescription}`);
    return NextResponse.redirect(redirectUrl);
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.json(
      { error: 'Missing code or state parameter from Xero callback' },
      { status: 400 }
    );
  }

  try {
    const result = await handleXeroCallback(code, state);

    // Redirect to connections page with success
    const redirectUrl = new URL('/dashboard/connections', request.url);
    redirectUrl.searchParams.set('connected', 'xero');
    redirectUrl.searchParams.set('tenant', result.tenantName);
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error('Xero callback error:', err);

    const redirectUrl = new URL('/dashboard/connections', request.url);
    redirectUrl.searchParams.set(
      'error',
      err instanceof Error ? err.message : 'Failed to connect Xero'
    );
    return NextResponse.redirect(redirectUrl);
  }
}
