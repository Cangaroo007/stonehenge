import { NextRequest, NextResponse } from 'next/server';
import { handleMyobCallback } from '@/lib/services/myob-auth-manager';

/**
 * GET /api/auth/myob/callback
 *
 * MYOB redirects here after the user approves the OAuth consent.
 * We exchange the code for tokens, fetch company files, store them encrypted,
 * and redirect the user back to the connections page.
 *
 * Query params (set by MYOB):
 *   - code:  authorization code
 *   - state: our base64url-encoded state blob
 *   - error: present if user denied
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const error = searchParams.get('error');
  if (error) {
    const errorDescription =
      searchParams.get('error_description') ?? 'User denied consent';
    console.warn('MYOB OAuth denied:', error, errorDescription);

    const redirectUrl = new URL('/dashboard/connections', request.url);
    redirectUrl.searchParams.set('error', `MYOB: ${errorDescription}`);
    return NextResponse.redirect(redirectUrl);
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.json(
      { error: 'Missing code or state parameter from MYOB callback' },
      { status: 400 }
    );
  }

  try {
    const result = await handleMyobCallback(code, state);

    const redirectUrl = new URL('/dashboard/connections', request.url);
    redirectUrl.searchParams.set('connected', 'myob');
    redirectUrl.searchParams.set('company', result.companyFileName);
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error('MYOB callback error:', err);

    const redirectUrl = new URL('/dashboard/connections', request.url);
    redirectUrl.searchParams.set(
      'error',
      err instanceof Error ? err.message : 'Failed to connect MYOB'
    );
    return NextResponse.redirect(redirectUrl);
  }
}
