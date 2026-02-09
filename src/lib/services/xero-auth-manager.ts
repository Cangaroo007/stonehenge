/**
 * Xero OAuth 2.0 Auth Manager
 *
 * Handles the full OAuth 2.0 Authorization Code flow for Xero:
 *  1. Build the authorization URL  (login redirect)
 *  2. Exchange the code for tokens  (callback)
 *  3. Refresh expired access tokens (background / on-demand)
 *  4. Persist encrypted tokens in the AccountingConnection table
 *  5. Retrieve usable access tokens for API calls
 *
 * Scopes requested:
 *   - offline_access              (long-lived refresh token)
 *   - openid profile email        (identity)
 *   - accounting.transactions.read (forensic read-only data)
 *   - accounting.contacts.read     (supplier / creditor lookup)
 *   - accounting.reports.read      (trial balance, P&L, balance sheet)
 */

import { XeroClient } from 'xero-node';
import prisma from '@/lib/db';
import { encryptToken, decryptToken } from '@/lib/crypto';
import { AccountingProvider, ConnectionStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID ?? '';
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET ?? '';
const XERO_REDIRECT_URI =
  process.env.XERO_REDIRECT_URI ??
  `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/auth/xero/callback`;

const XERO_SCOPES = [
  'offline_access',
  'openid',
  'profile',
  'email',
  'accounting.transactions.read',
  'accounting.contacts.read',
  'accounting.reports.read',
].join(' ');

// Token expiry safety margin — refresh 5 minutes before actual expiry
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Singleton XeroClient (reusable across requests)
// ---------------------------------------------------------------------------

let _xeroClient: XeroClient | null = null;

function getXeroClient(): XeroClient {
  if (_xeroClient) return _xeroClient;

  if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) {
    throw new Error(
      'XERO_CLIENT_ID and XERO_CLIENT_SECRET must be set in environment variables'
    );
  }

  _xeroClient = new XeroClient({
    clientId: XERO_CLIENT_ID,
    clientSecret: XERO_CLIENT_SECRET,
    redirectUris: [XERO_REDIRECT_URI],
    scopes: XERO_SCOPES.split(' '),
  });

  return _xeroClient;
}

// ---------------------------------------------------------------------------
// State token helpers  (CSRF protection)
// ---------------------------------------------------------------------------

/**
 * Build an opaque state parameter that encodes the user / company context.
 * The state is a base64-encoded JSON blob. In production you'd sign it too.
 */
export function buildStateParam(params: {
  userId: number;
  companyId: number;
  matterReference?: string;
}): string {
  const payload = {
    ...params,
    ts: Date.now(),
  };
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
    throw new Error('Invalid OAuth state parameter');
  }
}

// ---------------------------------------------------------------------------
// 1. Build Authorization URL
// ---------------------------------------------------------------------------

export async function getXeroAuthUrl(params: {
  userId: number;
  companyId: number;
  matterReference?: string;
}): Promise<string> {
  const client = getXeroClient();
  const state = buildStateParam(params);

  // xero-node builds the consent URL for us
  const consentUrl = await client.buildConsentUrl();

  // Append our state parameter
  const url = new URL(consentUrl);
  url.searchParams.set('state', state);

  return url.toString();
}

// ---------------------------------------------------------------------------
// 2. Exchange authorization code for tokens (callback handler)
// ---------------------------------------------------------------------------

export async function handleXeroCallback(
  code: string,
  state: string
): Promise<{ connectionId: number; tenantName: string }> {
  const { userId, companyId, matterReference } = parseStateParam(state);

  // Validate state freshness (10-minute window)
  const stateData = parseStateParam(state);
  if (Date.now() - stateData.ts > 10 * 60 * 1000) {
    throw new Error('OAuth state has expired — please try connecting again');
  }

  // Exchange code for tokens via Xero API
  const tokenResponse = await exchangeCodeForTokens(code);

  // Retrieve tenants (organisations) the user granted access to
  const tenants = await fetchXeroTenants(tokenResponse.access_token);

  if (!tenants.length) {
    throw new Error(
      'No Xero organisations found. The user may not have granted access to any organisation.'
    );
  }

  // Use the first tenant (most common case — single org)
  const tenant = tenants[0];

  // Calculate token expiry
  const expiresAt = new Date(
    Date.now() + (tokenResponse.expires_in ?? 1800) * 1000
  );

  // Upsert the connection
  const connection = await prisma.accountingConnection.upsert({
    where: {
      companyId_provider_externalTenantId: {
        companyId,
        provider: AccountingProvider.XERO,
        externalTenantId: tenant.tenantId,
      },
    },
    update: {
      accessTokenEnc: encryptToken(tokenResponse.access_token),
      refreshTokenEnc: encryptToken(tokenResponse.refresh_token),
      tokenExpiresAt: expiresAt,
      externalTenantName: tenant.tenantName,
      status: ConnectionStatus.ACTIVE,
      scopes: XERO_SCOPES.split(' '),
      connectedByUserId: userId,
      matterReference: matterReference ?? undefined,
      lastError: null,
    },
    create: {
      companyId,
      connectedByUserId: userId,
      provider: AccountingProvider.XERO,
      status: ConnectionStatus.ACTIVE,
      externalTenantId: tenant.tenantId,
      externalTenantName: tenant.tenantName,
      accessTokenEnc: encryptToken(tokenResponse.access_token),
      refreshTokenEnc: encryptToken(tokenResponse.refresh_token),
      tokenExpiresAt: expiresAt,
      scopes: XERO_SCOPES.split(' '),
      matterReference: matterReference ?? undefined,
    },
  });

  return {
    connectionId: connection.id,
    tenantName: tenant.tenantName ?? tenant.tenantId,
  };
}

// ---------------------------------------------------------------------------
// 3. Get a usable access token (auto-refreshing)
// ---------------------------------------------------------------------------

/**
 * Retrieve a valid access token for a given connection.
 * If the token is expired (or within the buffer), it is refreshed first.
 */
export async function getAccessToken(connectionId: number): Promise<{
  accessToken: string;
  tenantId: string;
}> {
  const connection = await prisma.accountingConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    throw new Error(`Accounting connection ${connectionId} not found`);
  }

  if (connection.status === ConnectionStatus.REVOKED) {
    throw new Error('This Xero connection has been revoked. Please reconnect.');
  }

  const now = new Date();
  const expiresAt = new Date(connection.tokenExpiresAt);

  // If the token is still valid, return it
  if (expiresAt.getTime() - EXPIRY_BUFFER_MS > now.getTime()) {
    return {
      accessToken: decryptToken(connection.accessTokenEnc),
      tenantId: connection.externalTenantId!,
    };
  }

  // Otherwise, refresh
  return refreshAndPersist(connection.id);
}

// ---------------------------------------------------------------------------
// 4. Refresh tokens
// ---------------------------------------------------------------------------

async function refreshAndPersist(connectionId: number): Promise<{
  accessToken: string;
  tenantId: string;
}> {
  const connection = await prisma.accountingConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    throw new Error(`Connection ${connectionId} not found during refresh`);
  }

  const refreshToken = decryptToken(connection.refreshTokenEnc);

  try {
    const tokenResponse = await refreshTokens(refreshToken);

    const expiresAt = new Date(
      Date.now() + (tokenResponse.expires_in ?? 1800) * 1000
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
      tenantId: connection.externalTenantId!,
    };
  } catch (error) {
    // Mark the connection as expired so the UI can prompt re-auth
    await prisma.accountingConnection.update({
      where: { id: connectionId },
      data: {
        status: ConnectionStatus.EXPIRED,
        lastError:
          error instanceof Error ? error.message : 'Token refresh failed',
      },
    });

    throw new Error(
      'Failed to refresh Xero token. The user needs to reconnect.'
    );
  }
}

// ---------------------------------------------------------------------------
// 5. Revoke / disconnect
// ---------------------------------------------------------------------------

export async function revokeConnection(connectionId: number): Promise<void> {
  const connection = await prisma.accountingConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    throw new Error(`Connection ${connectionId} not found`);
  }

  // Attempt to revoke the token at Xero (best-effort)
  try {
    const accessToken = decryptToken(connection.accessTokenEnc);
    await revokeXeroToken(accessToken);
  } catch {
    // Non-fatal — we still mark it revoked locally
  }

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
// 6. List connections for a company
// ---------------------------------------------------------------------------

export async function listConnections(companyId: number) {
  return prisma.accountingConnection.findMany({
    where: { companyId },
    select: {
      id: true,
      provider: true,
      status: true,
      externalTenantId: true,
      externalTenantName: true,
      scopes: true,
      matterReference: true,
      matterName: true,
      lastSyncAt: true,
      lastError: true,
      connectedByUser: {
        select: { id: true, name: true, email: true },
      },
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// Raw HTTP helpers (thin wrappers around Xero's token & identity endpoints)
// ---------------------------------------------------------------------------

interface XeroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

interface XeroTenant {
  tenantId: string;
  tenantName: string;
  tenantType: string;
}

async function exchangeCodeForTokens(
  code: string
): Promise<XeroTokenResponse> {
  const credentials = Buffer.from(
    `${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: XERO_REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Xero token exchange failed (${res.status}): ${body}`);
  }

  return res.json();
}

async function refreshTokens(
  refreshToken: string
): Promise<XeroTokenResponse> {
  const credentials = Buffer.from(
    `${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Xero token refresh failed (${res.status}): ${body}`);
  }

  return res.json();
}

async function fetchXeroTenants(accessToken: string): Promise<XeroTenant[]> {
  const res = await fetch('https://api.xero.com/connections', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch Xero tenants (${res.status}): ${body}`);
  }

  return res.json();
}

async function revokeXeroToken(accessToken: string): Promise<void> {
  const credentials = Buffer.from(
    `${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`
  ).toString('base64');

  await fetch('https://identity.xero.com/connect/revocation', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      token: accessToken,
    }),
  });
}
