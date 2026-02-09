/**
 * MYOB Business / AccountRight OAuth 2.0 Auth Manager
 *
 * Handles the full OAuth 2.0 Authorization Code flow for MYOB:
 *  1. Build the authorization URL  (login redirect)
 *  2. Exchange the code for tokens  (callback)
 *  3. Refresh expired access tokens
 *  4. Persist encrypted tokens in the AccountingConnection table
 *  5. Retrieve company files after auth
 *
 * MYOB uses a standard OAuth 2.0 flow with these endpoints:
 *   Authorization: https://secure.myob.com/oauth2/account/authorize
 *   Token:         https://secure.myob.com/oauth2/v1/authorize
 *   API Base:      https://api.myob.com/accountright/
 */

import prisma from '@/lib/db';
import { encryptToken, decryptToken } from '@/lib/crypto';
import { AccountingProvider, ConnectionStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MYOB_CLIENT_ID = process.env.MYOB_CLIENT_ID ?? '';
const MYOB_CLIENT_SECRET = process.env.MYOB_CLIENT_SECRET ?? '';
const MYOB_REDIRECT_URI =
  process.env.MYOB_REDIRECT_URI ??
  `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/auth/myob/callback`;

const MYOB_AUTH_URL = 'https://secure.myob.com/oauth2/account/authorize';
const MYOB_TOKEN_URL = 'https://secure.myob.com/oauth2/v1/authorize';
const MYOB_API_BASE = 'https://api.myob.com/accountright/';

// Scopes: MYOB doesn't use granular scopes like Xero.
// Access is controlled at the company-file level with username/password.
const MYOB_SCOPE = 'CompanyFile';

// Token expiry buffer (refresh 5 min before expiry)
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// State token helpers (same pattern as Xero)
// ---------------------------------------------------------------------------

export function buildStateParam(params: {
  userId: number;
  companyId: number;
  matterReference?: string;
}): string {
  const payload = { ...params, ts: Date.now(), provider: 'myob' };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function parseStateParam(state: string): {
  userId: number;
  companyId: number;
  matterReference?: string;
  ts: number;
} {
  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid MYOB OAuth state parameter');
  }
}

// ---------------------------------------------------------------------------
// 1. Build Authorization URL
// ---------------------------------------------------------------------------

export function getMyobAuthUrl(params: {
  userId: number;
  companyId: number;
  matterReference?: string;
}): string {
  if (!MYOB_CLIENT_ID) {
    throw new Error('MYOB_CLIENT_ID must be set in environment variables');
  }

  const state = buildStateParam(params);

  const url = new URL(MYOB_AUTH_URL);
  url.searchParams.set('client_id', MYOB_CLIENT_ID);
  url.searchParams.set('redirect_uri', MYOB_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', MYOB_SCOPE);
  url.searchParams.set('state', state);

  return url.toString();
}

// ---------------------------------------------------------------------------
// 2. Exchange authorization code for tokens
// ---------------------------------------------------------------------------

export async function handleMyobCallback(
  code: string,
  state: string
): Promise<{ connectionId: number; companyFileName: string }> {
  const { userId, companyId, matterReference } = parseStateParam(state);

  // Validate state freshness (10 min window)
  const stateData = parseStateParam(state);
  if (Date.now() - stateData.ts > 10 * 60 * 1000) {
    throw new Error('OAuth state has expired — please try connecting again');
  }

  // Exchange code for tokens
  const tokenResponse = await exchangeCodeForTokens(code);

  // Fetch available company files
  const companyFiles = await fetchMyobCompanyFiles(tokenResponse.access_token);

  if (!companyFiles.length) {
    throw new Error(
      'No MYOB company files found. The user may not have any accessible company files.'
    );
  }

  // Use the first company file (user can switch later)
  const companyFile = companyFiles[0];

  const expiresAt = new Date(
    Date.now() + (tokenResponse.expires_in ?? 1200) * 1000
  );

  // Upsert the connection
  const connection = await prisma.accountingConnection.upsert({
    where: {
      companyId_provider_externalTenantId: {
        companyId,
        provider: AccountingProvider.MYOB,
        externalTenantId: companyFile.Id,
      },
    },
    update: {
      accessTokenEnc: encryptToken(tokenResponse.access_token),
      refreshTokenEnc: encryptToken(tokenResponse.refresh_token),
      tokenExpiresAt: expiresAt,
      externalTenantName: companyFile.Name,
      status: ConnectionStatus.ACTIVE,
      scopes: [MYOB_SCOPE],
      connectedByUserId: userId,
      matterReference: matterReference ?? undefined,
      lastError: null,
      metadata: {
        companyFileUri: companyFile.Uri,
        companyFileLibraryPath: companyFile.LibraryPath,
        serialNumber: companyFile.SerialNumber,
      },
    },
    create: {
      companyId,
      connectedByUserId: userId,
      provider: AccountingProvider.MYOB,
      status: ConnectionStatus.ACTIVE,
      externalTenantId: companyFile.Id,
      externalTenantName: companyFile.Name,
      accessTokenEnc: encryptToken(tokenResponse.access_token),
      refreshTokenEnc: encryptToken(tokenResponse.refresh_token),
      tokenExpiresAt: expiresAt,
      scopes: [MYOB_SCOPE],
      matterReference: matterReference ?? undefined,
      metadata: {
        companyFileUri: companyFile.Uri,
        companyFileLibraryPath: companyFile.LibraryPath,
        serialNumber: companyFile.SerialNumber,
      },
    },
  });

  return {
    connectionId: connection.id,
    companyFileName: companyFile.Name,
  };
}

// ---------------------------------------------------------------------------
// 3. Get a usable access token (auto-refreshing)
// ---------------------------------------------------------------------------

export async function getAccessToken(connectionId: number): Promise<{
  accessToken: string;
  companyFileUri: string;
}> {
  const connection = await prisma.accountingConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    throw new Error(`MYOB connection ${connectionId} not found`);
  }

  if (connection.status === ConnectionStatus.REVOKED) {
    throw new Error('This MYOB connection has been revoked. Please reconnect.');
  }

  const now = new Date();
  const expiresAt = new Date(connection.tokenExpiresAt);

  const metadata = connection.metadata as Record<string, string> | null;
  const companyFileUri = metadata?.companyFileUri ?? MYOB_API_BASE;

  if (expiresAt.getTime() - EXPIRY_BUFFER_MS > now.getTime()) {
    return {
      accessToken: decryptToken(connection.accessTokenEnc),
      companyFileUri,
    };
  }

  // Refresh
  return refreshAndPersist(connection.id, companyFileUri);
}

// ---------------------------------------------------------------------------
// 4. Refresh tokens
// ---------------------------------------------------------------------------

async function refreshAndPersist(
  connectionId: number,
  companyFileUri: string
): Promise<{
  accessToken: string;
  companyFileUri: string;
}> {
  const connection = await prisma.accountingConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    throw new Error(`MYOB connection ${connectionId} not found during refresh`);
  }

  const refreshToken = decryptToken(connection.refreshTokenEnc);

  try {
    const tokenResponse = await refreshTokens(refreshToken);

    const expiresAt = new Date(
      Date.now() + (tokenResponse.expires_in ?? 1200) * 1000
    );

    await prisma.accountingConnection.update({
      where: { id: connectionId },
      data: {
        accessTokenEnc: encryptToken(tokenResponse.access_token),
        refreshTokenEnc: encryptToken(tokenResponse.refresh_token),
        tokenExpiresAt: expiresAt,
        status: ConnectionStatus.ACTIVE,
        lastError: null,
      },
    });

    return {
      accessToken: tokenResponse.access_token,
      companyFileUri,
    };
  } catch (error) {
    await prisma.accountingConnection.update({
      where: { id: connectionId },
      data: {
        status: ConnectionStatus.EXPIRED,
        lastError:
          error instanceof Error ? error.message : 'MYOB token refresh failed',
      },
    });

    throw new Error(
      'Failed to refresh MYOB token. The user needs to reconnect.'
    );
  }
}

// ---------------------------------------------------------------------------
// 5. Revoke / disconnect
// ---------------------------------------------------------------------------

export async function revokeConnection(connectionId: number): Promise<void> {
  await prisma.accountingConnection.update({
    where: { id: connectionId },
    data: {
      status: ConnectionStatus.REVOKED,
      accessTokenEnc: encryptToken('revoked'),
      refreshTokenEnc: encryptToken('revoked'),
    },
  });
}

// ---------------------------------------------------------------------------
// Raw HTTP helpers
// ---------------------------------------------------------------------------

interface MyobTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface MyobCompanyFile {
  Id: string;
  Name: string;
  Uri: string;
  LibraryPath: string;
  SerialNumber: string;
}

async function exchangeCodeForTokens(
  code: string
): Promise<MyobTokenResponse> {
  const res = await fetch(MYOB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: MYOB_CLIENT_ID,
      client_secret: MYOB_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: MYOB_REDIRECT_URI,
      scope: MYOB_SCOPE,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MYOB token exchange failed (${res.status}): ${body}`);
  }

  return res.json();
}

async function refreshTokens(
  refreshToken: string
): Promise<MyobTokenResponse> {
  const res = await fetch(MYOB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: MYOB_CLIENT_ID,
      client_secret: MYOB_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MYOB token refresh failed (${res.status}): ${body}`);
  }

  return res.json();
}

async function fetchMyobCompanyFiles(
  accessToken: string
): Promise<MyobCompanyFile[]> {
  const res = await fetch(MYOB_API_BASE, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-myobapi-key': MYOB_CLIENT_ID,
      'x-myobapi-version': 'v2',
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Failed to fetch MYOB company files (${res.status}): ${body}`
    );
  }

  return res.json();
}
