// Client-safe types and diff logic for quote version history
// This file is imported by client components and must not import server-only modules

export interface FieldChange {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface ChangeSummary {
  fieldChanges: FieldChange[];
  piecesAdded: Array<{ name: string; room: string; dimensions: string }>;
  piecesRemoved: Array<{ name: string; room: string; dimensions: string }>;
  piecesModified: Array<{ name: string; room: string; changes: string[] }>;
  description: string;
}

// Minimal snapshot shape needed for diffing (mirrors QuoteSnapshot from the service)
export interface SnapshotForDiff {
  status: string;
  clientType: string | null;
  clientTier: string | null;
  notes: string | null;
  projectName: string | null;
  projectAddress: string | null;
  customer: { id: number; name: string } | null;
  material: { id: number; name: string } | null;
  rooms: Array<{
    name: string;
    pieces: Array<{
      id: number;
      name: string;
      widthMm: number;
      lengthMm: number;
      thicknessMm: number;
      materialName: string | null;
      edgeTop: string | null;
      edgeBottom: string | null;
      edgeLeft: string | null;
      edgeRight: string | null;
    }>;
  }>;
  pricing: {
    subtotal: number;
    taxAmount: number;
    total: number;
    deliveryCost: number | null;
    templatingCost: number | null;
  };
  delivery: {
    deliveryAddress: string | null;
    templatingRequired: boolean;
  };
}

/**
 * Generates a detailed change summary comparing two snapshots (client-safe)
 */
export function generateDetailedChangeSummary(
  oldSnapshot: SnapshotForDiff,
  newSnapshot: SnapshotForDiff
): ChangeSummary {
  const fieldChanges: FieldChange[] = [];
  const piecesAdded: ChangeSummary['piecesAdded'] = [];
  const piecesRemoved: ChangeSummary['piecesRemoved'] = [];
  const piecesModified: ChangeSummary['piecesModified'] = [];

  // Compare top-level fields
  const fieldMap: Array<{ key: keyof Pick<SnapshotForDiff, 'status' | 'clientType' | 'clientTier' | 'notes' | 'projectName' | 'projectAddress'>; label: string }> = [
    { key: 'status', label: 'Status' },
    { key: 'clientType', label: 'Client Type' },
    { key: 'clientTier', label: 'Client Tier' },
    { key: 'notes', label: 'Notes' },
    { key: 'projectName', label: 'Project Name' },
    { key: 'projectAddress', label: 'Project Address' },
  ];

  for (const { key, label } of fieldMap) {
    if (oldSnapshot[key] !== newSnapshot[key]) {
      fieldChanges.push({ field: key, label, oldValue: oldSnapshot[key], newValue: newSnapshot[key] });
    }
  }

  // Compare customer
  if (oldSnapshot.customer?.id !== newSnapshot.customer?.id) {
    fieldChanges.push({
      field: 'customer',
      label: 'Customer',
      oldValue: oldSnapshot.customer?.name ?? '(none)',
      newValue: newSnapshot.customer?.name ?? '(none)',
    });
  }

  // Compare material
  if (oldSnapshot.material?.id !== newSnapshot.material?.id) {
    fieldChanges.push({
      field: 'material',
      label: 'Material',
      oldValue: oldSnapshot.material?.name ?? '(none)',
      newValue: newSnapshot.material?.name ?? '(none)',
    });
  }

  // Compare pricing
  const pricingFields: Array<{ key: keyof SnapshotForDiff['pricing']; label: string }> = [
    { key: 'subtotal', label: 'Subtotal' },
    { key: 'taxAmount', label: 'Tax Amount' },
    { key: 'total', label: 'Total' },
    { key: 'deliveryCost', label: 'Delivery Cost' },
    { key: 'templatingCost', label: 'Templating Cost' },
  ];

  for (const { key, label } of pricingFields) {
    if (oldSnapshot.pricing[key] !== newSnapshot.pricing[key]) {
      fieldChanges.push({
        field: `pricing.${key}`,
        label,
        oldValue: oldSnapshot.pricing[key],
        newValue: newSnapshot.pricing[key],
      });
    }
  }

  // Compare delivery
  if (oldSnapshot.delivery.deliveryAddress !== newSnapshot.delivery.deliveryAddress) {
    fieldChanges.push({
      field: 'delivery.deliveryAddress',
      label: 'Delivery Address',
      oldValue: oldSnapshot.delivery.deliveryAddress ?? '(none)',
      newValue: newSnapshot.delivery.deliveryAddress ?? '(none)',
    });
  }

  if (oldSnapshot.delivery.templatingRequired !== newSnapshot.delivery.templatingRequired) {
    fieldChanges.push({
      field: 'delivery.templatingRequired',
      label: 'Templating Required',
      oldValue: oldSnapshot.delivery.templatingRequired ? 'Yes' : 'No',
      newValue: newSnapshot.delivery.templatingRequired ? 'Yes' : 'No',
    });
  }

  // Compare pieces
  type PieceInfo = { name: string; room: string; widthMm: number; lengthMm: number; thicknessMm: number; materialName: string | null; edgeTop: string | null; edgeBottom: string | null; edgeLeft: string | null; edgeRight: string | null };
  const oldPieces = new Map<number, PieceInfo>();
  const newPieces = new Map<number, PieceInfo>();

  for (const room of oldSnapshot.rooms) {
    for (const piece of room.pieces) {
      oldPieces.set(piece.id, {
        name: piece.name,
        room: room.name,
        widthMm: piece.widthMm,
        lengthMm: piece.lengthMm,
        thicknessMm: piece.thicknessMm,
        materialName: piece.materialName,
        edgeTop: piece.edgeTop,
        edgeBottom: piece.edgeBottom,
        edgeLeft: piece.edgeLeft,
        edgeRight: piece.edgeRight,
      });
    }
  }

  for (const room of newSnapshot.rooms) {
    for (const piece of room.pieces) {
      newPieces.set(piece.id, {
        name: piece.name,
        room: room.name,
        widthMm: piece.widthMm,
        lengthMm: piece.lengthMm,
        thicknessMm: piece.thicknessMm,
        materialName: piece.materialName,
        edgeTop: piece.edgeTop,
        edgeBottom: piece.edgeBottom,
        edgeLeft: piece.edgeLeft,
        edgeRight: piece.edgeRight,
      });
    }
  }

  const oldPieceIds = Array.from(oldPieces.keys());
  const newPieceIds = Array.from(newPieces.keys());

  // Find added pieces
  for (const id of newPieceIds) {
    if (!oldPieces.has(id)) {
      const p = newPieces.get(id)!;
      piecesAdded.push({ name: p.name, room: p.room, dimensions: `${p.widthMm} x ${p.lengthMm}mm` });
    }
  }

  // Find removed pieces
  for (const id of oldPieceIds) {
    if (!newPieces.has(id)) {
      const p = oldPieces.get(id)!;
      piecesRemoved.push({ name: p.name, room: p.room, dimensions: `${p.widthMm} x ${p.lengthMm}mm` });
    }
  }

  // Find modified pieces
  for (const id of newPieceIds) {
    if (oldPieces.has(id)) {
      const oldP = oldPieces.get(id)!;
      const newP = newPieces.get(id)!;
      const changes: string[] = [];

      if (oldP.name !== newP.name) changes.push(`Name: ${oldP.name} → ${newP.name}`);
      if (oldP.widthMm !== newP.widthMm || oldP.lengthMm !== newP.lengthMm) {
        changes.push(`Dimensions: ${oldP.widthMm}x${oldP.lengthMm} → ${newP.widthMm}x${newP.lengthMm}mm`);
      }
      if (oldP.thicknessMm !== newP.thicknessMm) {
        changes.push(`Thickness: ${oldP.thicknessMm} → ${newP.thicknessMm}mm`);
      }
      if (oldP.materialName !== newP.materialName) {
        changes.push(`Material: ${oldP.materialName ?? '(none)'} → ${newP.materialName ?? '(none)'}`);
      }
      if (oldP.edgeTop !== newP.edgeTop) changes.push(`Top edge: ${oldP.edgeTop ?? 'none'} → ${newP.edgeTop ?? 'none'}`);
      if (oldP.edgeBottom !== newP.edgeBottom) changes.push(`Bottom edge: ${oldP.edgeBottom ?? 'none'} → ${newP.edgeBottom ?? 'none'}`);
      if (oldP.edgeLeft !== newP.edgeLeft) changes.push(`Left edge: ${oldP.edgeLeft ?? 'none'} → ${newP.edgeLeft ?? 'none'}`);
      if (oldP.edgeRight !== newP.edgeRight) changes.push(`Right edge: ${oldP.edgeRight ?? 'none'} → ${newP.edgeRight ?? 'none'}`);

      if (changes.length > 0) {
        piecesModified.push({ name: newP.name, room: newP.room, changes });
      }
    }
  }

  // Build description
  const parts: string[] = [];
  if (fieldChanges.length > 0) parts.push(`${fieldChanges.length} field change(s)`);
  if (piecesAdded.length > 0) parts.push(`${piecesAdded.length} piece(s) added`);
  if (piecesRemoved.length > 0) parts.push(`${piecesRemoved.length} piece(s) removed`);
  if (piecesModified.length > 0) parts.push(`${piecesModified.length} piece(s) modified`);
  const description = parts.length > 0 ? parts.join(', ') : 'No significant changes detected';

  return { fieldChanges, piecesAdded, piecesRemoved, piecesModified, description };
}
