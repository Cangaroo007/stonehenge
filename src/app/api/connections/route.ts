import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listConnections } from '@/lib/services/xero-auth-manager';
import { revokeConnection as revokeXero } from '@/lib/services/xero-auth-manager';
import { revokeConnection as revokeMyob } from '@/lib/services/myob-auth-manager';
import prisma from '@/lib/db';
import { AccountingProvider } from '@prisma/client';

/**
 * GET /api/connections
 *
 * List all accounting connections (Xero & MYOB) for the authenticated
 * user's company. Returns provider, status, tenant name, and metadata
 * — never raw tokens.
 */
export async function GET() {
  try {
    const authResult = await requireAuth();

    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const connections = await listConnections(authResult.user.companyId);

    return NextResponse.json({ connections });
  } catch (error) {
    console.error('List connections error:', error);
    return NextResponse.json(
      { error: 'Failed to list connections' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/connections?id=<connectionId>
 *
 * Revoke and disconnect an accounting connection. This invalidates the
 * stored tokens and marks the connection as REVOKED.
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(['ADMIN', 'SALES_MANAGER']);

    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const connectionId = request.nextUrl.searchParams.get('id');
    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    const id = parseInt(connectionId, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid connection ID' },
        { status: 400 }
      );
    }

    // Verify the connection belongs to the user's company
    const connection = await prisma.accountingConnection.findUnique({
      where: { id },
      select: { companyId: true, provider: true },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    if (connection.companyId !== authResult.user.companyId) {
      return NextResponse.json(
        { error: 'Forbidden: connection belongs to another company' },
        { status: 403 }
      );
    }

    // Revoke using the appropriate provider manager
    if (connection.provider === AccountingProvider.XERO) {
      await revokeXero(id);
    } else if (connection.provider === AccountingProvider.MYOB) {
      await revokeMyob(id);
    }

    return NextResponse.json({ success: true, message: 'Connection revoked' });
  } catch (error) {
    console.error('Revoke connection error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to revoke connection',
      },
      { status: 500 }
    );
  }
}
