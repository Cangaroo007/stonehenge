import { prisma } from '@/lib/db';
import { Prisma, QuoteChangeType } from '@prisma/client';

// Type for the snapshot data structure
export interface QuoteSnapshot {
  // Quote header info
  quoteNumber: string;
  status: string;
  clientType: string | null;
  clientTier: string | null;
  
  // Customer info
  customer: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  
  // Material info (if there's a common material)
  material: {
    id: number;
    name: string;
    pricePerSqm: number;
  } | null;
  
  // Rooms and pieces
  rooms: Array<{
    id: number;
    name: string;
    sortOrder: number;
    pieces: Array<{
      id: number;
      name: string;
      widthMm: number;
      lengthMm: number;
      thicknessMm: number;
      areaSqm: number;
      materialId: number | null;
      materialName: string | null;
      edgeTop: string | null;
      edgeBottom: string | null;
      edgeLeft: string | null;
      edgeRight: string | null;
      cutouts: unknown;
      features: Array<{
        id: number;
        name: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
    }>;
  }>;
  
  // Pricing breakdown
  pricing: {
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    calculatedTotal: number | null;
    deliveryCost: number | null;
    templatingCost: number | null;
    
    // Any overrides
    overrides: {
      overrideSubtotal: number | null;
      overrideTotal: number | null;
      overrideDeliveryCost: number | null;
      overrideTemplatingCost: number | null;
      overrideReason: string | null;
    };
  };
  
  // Delivery info
  delivery: {
    deliveryAddress: string | null;
    deliveryDistanceKm: number | null;
    templatingRequired: boolean;
    templatingDistanceKm: number | null;
  };
  
  // Metadata
  notes: string | null;
  internalNotes: string | null;
  validUntil: string | null;
  projectName: string | null;
  projectAddress: string | null;
}

/**
 * Creates a complete snapshot of a quote's current state
 */
export async function createQuoteSnapshot(quoteId: number): Promise<QuoteSnapshot> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      customer: {
        include: {
          clientType: true,
          clientTier: true,
        },
      },
      rooms: {
        orderBy: { sortOrder: 'asc' },
        include: {
          pieces: {
            orderBy: { sortOrder: 'asc' },
            include: {
              features: true,
              material: true,
            },
          },
        },
      },
    },
  });

  if (!quote) {
    throw new Error(`Quote ${quoteId} not found`);
  }

  // Get the most common material if there is one
  let commonMaterial: { id: number; name: string; pricePerSqm: number } | null = null;
  const materials = quote.rooms.flatMap(r => r.pieces.map(p => p.material).filter(Boolean));
  if (materials.length > 0) {
    const firstMaterial = materials[0];
    if (firstMaterial) {
      commonMaterial = {
        id: firstMaterial.id,
        name: firstMaterial.name,
        pricePerSqm: Number(firstMaterial.pricePerSqm),
      };
    }
  }

  return {
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    clientType: quote.customer?.clientType?.name ?? null,
    clientTier: quote.customer?.clientTier?.name ?? null,
    
    customer: quote.customer ? {
      id: quote.customer.id,
      name: quote.customer.name,
      email: quote.customer.email,
      phone: quote.customer.phone,
    } : null,
    
    material: commonMaterial,
    
    rooms: quote.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      sortOrder: room.sortOrder,
      pieces: room.pieces.map((piece) => ({
        id: piece.id,
        name: piece.name,
        widthMm: piece.widthMm,
        lengthMm: piece.lengthMm,
        thicknessMm: piece.thicknessMm,
        areaSqm: Number(piece.areaSqm),
        materialId: piece.materialId,
        materialName: piece.materialName,
        edgeTop: piece.edgeTop,
        edgeBottom: piece.edgeBottom,
        edgeLeft: piece.edgeLeft,
        edgeRight: piece.edgeRight,
        cutouts: piece.cutouts,
        features: piece.features.map((f) => ({
          id: f.id,
          name: f.name,
          quantity: f.quantity,
          unitPrice: Number(f.unitPrice),
          totalPrice: Number(f.totalPrice),
        })),
      })),
    })),
    
    pricing: {
      subtotal: Number(quote.subtotal),
      taxRate: Number(quote.taxRate),
      taxAmount: Number(quote.taxAmount),
      total: Number(quote.total),
      calculatedTotal: quote.calculatedTotal ? Number(quote.calculatedTotal) : null,
      deliveryCost: quote.deliveryCost ? Number(quote.deliveryCost) : null,
      templatingCost: quote.templatingCost ? Number(quote.templatingCost) : null,
      overrides: {
        overrideSubtotal: quote.overrideSubtotal ? Number(quote.overrideSubtotal) : null,
        overrideTotal: quote.overrideTotal ? Number(quote.overrideTotal) : null,
        overrideDeliveryCost: quote.overrideDeliveryCost ? Number(quote.overrideDeliveryCost) : null,
        overrideTemplatingCost: quote.overrideTemplatingCost ? Number(quote.overrideTemplatingCost) : null,
        overrideReason: quote.overrideReason,
      },
    },
    
    delivery: {
      deliveryAddress: quote.deliveryAddress,
      deliveryDistanceKm: quote.deliveryDistanceKm ? Number(quote.deliveryDistanceKm) : null,
      templatingRequired: quote.templatingRequired,
      templatingDistanceKm: quote.templatingDistanceKm ? Number(quote.templatingDistanceKm) : null,
    },
    
    notes: quote.notes,
    internalNotes: quote.internalNotes,
    validUntil: quote.validUntil?.toISOString() ?? null,
    projectName: quote.projectName,
    projectAddress: quote.projectAddress,
  };
}

/**
 * Compares two snapshots and returns the differences
 */
export function compareSnapshots(
  oldSnapshot: QuoteSnapshot,
  newSnapshot: QuoteSnapshot
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  // Compare top-level fields
  const topLevelFields = ['status', 'clientType', 'clientTier', 'notes', 'projectName', 'projectAddress'] as const;
  for (const field of topLevelFields) {
    if (oldSnapshot[field] !== newSnapshot[field]) {
      changes[field] = { old: oldSnapshot[field], new: newSnapshot[field] };
    }
  }

  // Compare customer
  if (oldSnapshot.customer?.id !== newSnapshot.customer?.id) {
    changes['customer'] = { 
      old: oldSnapshot.customer?.name ?? null, 
      new: newSnapshot.customer?.name ?? null 
    };
  }

  // Compare material
  if (oldSnapshot.material?.id !== newSnapshot.material?.id) {
    changes['material'] = { 
      old: oldSnapshot.material?.name ?? null, 
      new: newSnapshot.material?.name ?? null 
    };
  }

  // Compare pricing
  const pricingFields = ['subtotal', 'taxAmount', 'total'] as const;
  for (const field of pricingFields) {
    if (oldSnapshot.pricing[field] !== newSnapshot.pricing[field]) {
      changes[`pricing.${field}`] = { 
        old: oldSnapshot.pricing[field], 
        new: newSnapshot.pricing[field] 
      };
    }
  }

  // Compare piece counts
  const oldPieceCount = oldSnapshot.rooms.reduce(
    (sum, r) => sum + r.pieces.length, 0
  );
  const newPieceCount = newSnapshot.rooms.reduce(
    (sum, r) => sum + r.pieces.length, 0
  );
  if (oldPieceCount !== newPieceCount) {
    changes['pieceCount'] = { old: oldPieceCount, new: newPieceCount };
  }

  // Compare room counts
  if (oldSnapshot.rooms.length !== newSnapshot.rooms.length) {
    changes['roomCount'] = { 
      old: oldSnapshot.rooms.length, 
      new: newSnapshot.rooms.length 
    };
  }

  // Compare delivery
  if (oldSnapshot.delivery.deliveryAddress !== newSnapshot.delivery.deliveryAddress) {
    changes['deliveryAddress'] = { 
      old: oldSnapshot.delivery.deliveryAddress, 
      new: newSnapshot.delivery.deliveryAddress 
    };
  }

  if (oldSnapshot.delivery.templatingRequired !== newSnapshot.delivery.templatingRequired) {
    changes['templatingRequired'] = { 
      old: oldSnapshot.delivery.templatingRequired, 
      new: newSnapshot.delivery.templatingRequired 
    };
  }

  return changes;
}

/**
 * Generates a human-readable summary of changes
 */
export function generateChangeSummary(
  changes: Record<string, { old: unknown; new: unknown }>,
  changeType: QuoteChangeType
): string {
  const parts: string[] = [];

  // Handle specific change types
  switch (changeType) {
    case 'CREATED':
      return 'Quote created';
    case 'ROLLED_BACK':
      return 'Restored from previous version';
    case 'SENT_TO_CLIENT':
      return 'Quote sent to client';
    case 'CLIENT_APPROVED':
      return 'Client approved and signed';
    case 'CLIENT_REJECTED':
      return 'Client declined';
    case 'CLIENT_VIEWED':
      return 'Client viewed quote';
  }

  // Build summary from changes
  if (changes['pieceCount']) {
    const diff = (changes['pieceCount'].new as number) - (changes['pieceCount'].old as number);
    if (diff > 0) {
      parts.push(`${diff} piece(s) added`);
    } else {
      parts.push(`${Math.abs(diff)} piece(s) removed`);
    }
  }

  if (changes['pricing.total']) {
    const oldTotal = changes['pricing.total'].old as number;
    const newTotal = changes['pricing.total'].new as number;
    const diff = newTotal - oldTotal;
    const sign = diff >= 0 ? '+' : '';
    parts.push(`Total ${sign}$${diff.toFixed(2)}`);
  }

  if (changes['status']) {
    parts.push(`Status: ${changes['status'].old} → ${changes['status'].new}`);
  }

  if (changes['material']) {
    parts.push(`Material changed to ${changes['material'].new}`);
  }

  if (changes['customer']) {
    parts.push(`Customer changed to ${changes['customer'].new}`);
  }

  if (changes['deliveryAddress']) {
    parts.push('Delivery address updated');
  }

  if (changes['templatingRequired']) {
    const required = changes['templatingRequired'].new as boolean;
    parts.push(required ? 'Templating added' : 'Templating removed');
  }

  return parts.length > 0 ? parts.join(', ') : 'Minor changes';
}

/**
 * Creates a new version record for a quote
 */
export async function createQuoteVersion(
  quoteId: number,
  userId: number,
  changeType: QuoteChangeType,
  changeReason?: string,
  previousSnapshot?: QuoteSnapshot,
  rolledBackFromVersion?: number
): Promise<void> {
  // Get current snapshot
  const currentSnapshot = await createQuoteSnapshot(quoteId);
  
  // Get the quote's current version number
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { currentVersion: true },
  });

  if (!quote) {
    throw new Error(`Quote ${quoteId} not found`);
  }

  const newVersionNumber = quote.currentVersion + 1;

  // Calculate changes if we have a previous snapshot
  let changes: Record<string, { old: unknown; new: unknown }> | null = null;
  let changeSummary: string | null = null;

  if (previousSnapshot) {
    changes = compareSnapshots(previousSnapshot, currentSnapshot);
    changeSummary = generateChangeSummary(changes, changeType);
  } else if (changeType === 'CREATED') {
    changeSummary = 'Quote created';
  }

  // Calculate piece count
  const pieceCount = currentSnapshot.rooms.reduce(
    (sum, r) => sum + r.pieces.length, 0
  );

  // Create version record and update quote in transaction
  await prisma.$transaction([
    prisma.quoteVersion.create({
      data: {
        quoteId,
        version: newVersionNumber,
        snapshotData: currentSnapshot as unknown as Prisma.InputJsonValue,
        changeType,
        changeReason,
        changeSummary,
        changes: changes as unknown as Prisma.InputJsonValue,
        changedByUserId: userId,
        rolledBackFromVersion,
        subtotal: currentSnapshot.pricing.subtotal,
        taxAmount: currentSnapshot.pricing.taxAmount,
        totalAmount: currentSnapshot.pricing.total,
        pieceCount,
      },
    }),
    prisma.quote.update({
      where: { id: quoteId },
      data: { currentVersion: newVersionNumber },
    }),
  ]);
}

/**
 * Creates the initial version when a quote is first created
 */
export async function createInitialVersion(
  quoteId: number,
  userId: number
): Promise<void> {
  const snapshot = await createQuoteSnapshot(quoteId);
  
  const pieceCount = snapshot.rooms.reduce(
    (sum, r) => sum + r.pieces.length, 0
  );

  await prisma.quoteVersion.create({
    data: {
      quoteId,
      version: 1,
      snapshotData: snapshot as unknown as Prisma.InputJsonValue,
      changeType: 'CREATED',
      changeSummary: 'Quote created',
      changedByUserId: userId,
      subtotal: snapshot.pricing.subtotal,
      taxAmount: snapshot.pricing.taxAmount,
      totalAmount: snapshot.pricing.total,
      pieceCount,
    },
  });
}

/**
 * Restores a quote to a previous version (creates new version with old data)
 */
export async function rollbackToVersion(
  quoteId: number,
  targetVersion: number,
  userId: number,
  reason?: string
): Promise<void> {
  // Get the target version's snapshot
  const targetVersionRecord = await prisma.quoteVersion.findUnique({
    where: {
      quoteId_version: {
        quoteId,
        version: targetVersion,
      },
    },
  });

  if (!targetVersionRecord) {
    throw new Error(`Version ${targetVersion} not found for quote ${quoteId}`);
  }

  const snapshot = targetVersionRecord.snapshotData as unknown as QuoteSnapshot;

  // Get current snapshot for comparison
  const currentSnapshot = await createQuoteSnapshot(quoteId);

  // Restore the quote data from snapshot
  await prisma.$transaction(async (tx) => {
    // Update quote header fields
    await tx.quote.update({
      where: { id: quoteId },
      data: {
        status: snapshot.status,
        notes: snapshot.notes,
        internalNotes: snapshot.internalNotes,
        projectName: snapshot.projectName,
        projectAddress: snapshot.projectAddress,
        subtotal: snapshot.pricing.subtotal,
        taxRate: snapshot.pricing.taxRate,
        taxAmount: snapshot.pricing.taxAmount,
        total: snapshot.pricing.total,
        calculatedTotal: snapshot.pricing.calculatedTotal,
        overrideSubtotal: snapshot.pricing.overrides.overrideSubtotal,
        overrideTotal: snapshot.pricing.overrides.overrideTotal,
        overrideDeliveryCost: snapshot.pricing.overrides.overrideDeliveryCost,
        overrideTemplatingCost: snapshot.pricing.overrides.overrideTemplatingCost,
        overrideReason: snapshot.pricing.overrides.overrideReason,
        deliveryAddress: snapshot.delivery.deliveryAddress,
        deliveryDistanceKm: snapshot.delivery.deliveryDistanceKm,
        templatingRequired: snapshot.delivery.templatingRequired,
        templatingDistanceKm: snapshot.delivery.templatingDistanceKm,
        deliveryCost: snapshot.pricing.deliveryCost,
        templatingCost: snapshot.pricing.templatingCost,
        validUntil: snapshot.validUntil ? new Date(snapshot.validUntil) : null,
      },
    });

    // Note: Full room/piece restoration would be complex and potentially dangerous
    // For now, we only restore header/pricing data
    // In a production system, you might want to add a full restore option
  });

  // Create the rollback version
  await createQuoteVersion(
    quoteId,
    userId,
    'ROLLED_BACK',
    reason || `Restored from version ${targetVersion}`,
    currentSnapshot,
    targetVersion
  );
}
