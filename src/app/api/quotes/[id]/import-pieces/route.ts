import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

interface ImportPieceData {
  name: string;
  length: number;
  width: number;
  thickness?: number;
  room?: string;
  material?: string;
  notes?: string;
  edgeTop?: string;
  edgeBottom?: string;
  edgeLeft?: string;
  edgeRight?: string;
}

interface ImportRequest {
  pieces: ImportPieceData[];
  sourceAnalysisId?: string;
}

// POST - Import multiple pieces from drawing analysis
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const quoteId = parseInt(id);

    if (isNaN(quoteId)) {
      return NextResponse.json({ error: 'Invalid quote ID' }, { status: 400 });
    }

    // Verify quote exists
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const data: ImportRequest = await request.json();
    const { pieces, sourceAnalysisId } = data;

    if (!pieces || !Array.isArray(pieces) || pieces.length === 0) {
      return NextResponse.json(
        { error: 'At least one piece is required' },
        { status: 400 }
      );
    }

    // Validate all pieces have required fields
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      if (!piece.name || !piece.length || !piece.width) {
        return NextResponse.json(
          { error: `Piece ${i + 1} is missing required fields (name, length, width)` },
          { status: 400 }
        );
      }
    }

    // Group pieces by room
    const piecesByRoom: Record<string, ImportPieceData[]> = {};
    for (const piece of pieces) {
      const roomName = piece.room || 'Kitchen';
      if (!piecesByRoom[roomName]) {
        piecesByRoom[roomName] = [];
      }
      piecesByRoom[roomName].push(piece);
    }

    const createdPieces: { id: number; name: string; room: string }[] = [];

    // Process each room
    for (const [roomName, roomPieces] of Object.entries(piecesByRoom)) {
      // Find or create the room
      let room = await prisma.quoteRoom.findFirst({
        where: {
          quoteId,
          name: roomName,
        },
      });

      if (!room) {
        // Get the highest sort order for rooms
        const maxRoom = await prisma.quoteRoom.findFirst({
          where: { quoteId },
          orderBy: { sortOrder: 'desc' },
        });

        room = await prisma.quoteRoom.create({
          data: {
            quoteId,
            name: roomName,
            sortOrder: (maxRoom?.sortOrder ?? -1) + 1,
          },
        });
      }

      // Get the highest piece sort order in the room
      const maxPiece = await prisma.quotePiece.findFirst({
        where: { roomId: room.id },
        orderBy: { sortOrder: 'desc' },
      });

      let sortOrder = (maxPiece?.sortOrder ?? -1) + 1;

      // Create each piece
      for (const pieceData of roomPieces) {
        const lengthMm = Math.round(pieceData.length);
        const widthMm = Math.round(pieceData.width);
        const thicknessMm = pieceData.thickness || 20;

        // Calculate area
        const areaSqm = (lengthMm * widthMm) / 1_000_000;

        const piece = await prisma.quotePiece.create({
          data: {
            roomId: room.id,
            name: pieceData.name,
            description: pieceData.notes || null,
            lengthMm,
            widthMm,
            thicknessMm,
            areaSqm,
            materialId: null,
            materialName: pieceData.material || null,
            materialCost: 0,
            totalCost: 0,
            sortOrder: sortOrder++,
            cutouts: [],
            edgeTop: pieceData.edgeTop || null,
            edgeBottom: pieceData.edgeBottom || null,
            edgeLeft: pieceData.edgeLeft || null,
            edgeRight: pieceData.edgeRight || null,
          },
        });

        createdPieces.push({
          id: piece.id,
          name: piece.name,
          room: roomName,
        });
      }
    }

    // If sourceAnalysisId is provided, update the analysis record with imported piece IDs
    if (sourceAnalysisId) {
      const analysisId = parseInt(sourceAnalysisId);
      if (!isNaN(analysisId)) {
        await prisma.quoteDrawingAnalysis.update({
          where: { id: analysisId },
          data: {
            importedPieces: createdPieces.map(p => p.id.toString()),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      imported: createdPieces,
      count: createdPieces.length,
    });

  } catch (error) {
    console.error('Error importing pieces:', error);
    return NextResponse.json(
      { error: 'Failed to import pieces' },
      { status: 500 }
    );
  }
}
