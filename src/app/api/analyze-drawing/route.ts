import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Type definitions for the new analysis format
interface AnalysisCutout {
  type: string;
  notes?: string;
}

interface AnalysisPiece {
  pieceNumber?: number;
  name: string;
  pieceType?: string;
  shape?: string;
  length: number;
  width: number;
  thickness?: number;
  cutouts?: AnalysisCutout[];
  notes?: string;
  confidence: number;
}

interface AnalysisRoom {
  name: string;
  pieces: AnalysisPiece[];
}

interface AnalysisMetadata {
  jobNumber: string | null;
  defaultThickness: number;
  defaultOverhang: number;
}

interface RawAnalysis {
  success: boolean;
  drawingType: 'cad_professional' | 'job_sheet' | 'hand_drawn' | 'architectural';
  metadata: AnalysisMetadata;
  rooms: AnalysisRoom[];
  warnings?: string[];
  questionsForUser?: string[];
}

// Legacy format for frontend compatibility
interface LegacyPiece {
  description: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  notes?: string;
}

interface LegacyAnalysis {
  roomType: string;
  confidence: 'high' | 'medium' | 'low';
  roomTypeReasoning?: string;
  pieces: LegacyPiece[];
  drawingNotes?: string;
}

// Transform new format to legacy format for frontend compatibility
function transformToLegacyFormat(raw: RawAnalysis): LegacyAnalysis {
  // Get the first room (primary room) or use a default
  const primaryRoom = raw.rooms[0] ?? { name: 'Unknown', pieces: [] };

  // Calculate average confidence across all pieces
  const allPieces = raw.rooms.flatMap(r => r.pieces);
  const avgConfidence = allPieces.length > 0
    ? allPieces.reduce((sum, p) => sum + p.confidence, 0) / allPieces.length
    : 0.5;

  // Map confidence number to category
  let confidenceLevel: 'high' | 'medium' | 'low';
  if (avgConfidence >= 0.8) {
    confidenceLevel = 'high';
  } else if (avgConfidence >= 0.6) {
    confidenceLevel = 'medium';
  } else {
    confidenceLevel = 'low';
  }

  // Transform pieces from all rooms to legacy format
  const legacyPieces: LegacyPiece[] = [];
  for (const room of raw.rooms) {
    for (const piece of room.pieces) {
      // Build description from piece name and cutouts
      let description = piece.name;
      if (piece.cutouts && piece.cutouts.length > 0) {
        const cutoutDesc = piece.cutouts.map(c => c.type).join(', ');
        description += ` (${cutoutDesc})`;
      }

      // Build notes including shape and any original notes
      const noteParts: string[] = [];
      if (piece.shape && piece.shape !== 'rectangular') {
        noteParts.push(`Shape: ${piece.shape}`);
      }
      if (piece.notes) {
        noteParts.push(piece.notes);
      }
      if (raw.rooms.length > 1) {
        noteParts.push(`Room: ${room.name}`);
      }

      legacyPieces.push({
        description,
        lengthMm: piece.length,
        widthMm: piece.width,
        thicknessMm: piece.thickness ?? raw.metadata.defaultThickness ?? 20,
        notes: noteParts.length > 0 ? noteParts.join('. ') : undefined,
      });
    }
  }

  // Build drawing notes from warnings and questions
  const drawingNotes: string[] = [];
  if (raw.warnings && raw.warnings.length > 0) {
    drawingNotes.push(`Warnings: ${raw.warnings.join('; ')}`);
  }
  if (raw.questionsForUser && raw.questionsForUser.length > 0) {
    drawingNotes.push(`Questions: ${raw.questionsForUser.join('; ')}`);
  }

  return {
    roomType: primaryRoom.name,
    confidence: confidenceLevel,
    roomTypeReasoning: `Drawing type: ${raw.drawingType}. Found ${raw.rooms.length} room(s) with ${allPieces.length} piece(s).`,
    pieces: legacyPieces,
    drawingNotes: drawingNotes.length > 0 ? drawingNotes.join(' ') : undefined,
  };
}

// Anthropic's image size limit is 5MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

async function compressImage(buffer: Buffer, mimeType: string): Promise<{ data: Buffer; mediaType: string }> {
  // Get image metadata to determine dimensions
  const metadata = await sharp(buffer).metadata();

  let sharpInstance = sharp(buffer);

  // Calculate target dimensions - max 4096px on longest side while maintaining aspect ratio
  const maxDimension = 4096;
  if (metadata.width && metadata.height) {
    const longestSide = Math.max(metadata.width, metadata.height);
    if (longestSide > maxDimension) {
      sharpInstance = sharpInstance.resize(maxDimension, maxDimension, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
  }

  // Convert to JPEG for better compression (unless it's a PNG with transparency we need to preserve)
  // For technical drawings, JPEG at quality 85 provides good balance
  const outputBuffer = await sharpInstance
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  return {
    data: outputBuffer,
    mediaType: 'image/jpeg',
  };
}

const SYSTEM_PROMPT = `You are an expert stone benchtop fabricator analyzing drawings to extract piece specifications for quoting.

DRAWING TYPES YOU MAY RECEIVE:
1. Professional CAD Drawings - Clean technical drawings with precise dimension lines
2. FileMaker Job Sheets - Form-style pages with CAD drawings, site photos, and metadata fields (Job No., Thickness, etc.)
3. Hand-Drawn Sketches - Rough sketches with handwritten measurements
4. Architectural Plans - Building floor plans with stone areas marked

WHAT TO EXTRACT:

Job Metadata (if visible):
- Job Number
- Default Thickness (usually 20mm or 40mm)
- Default Overhang (usually 10mm)
- Material/Color if specified

For Each Stone Piece:
- Piece number if marked (circled numbers like 1, 2, 3)
- Room/area label (Kitchen, Bathroom, Pantry, Laundry, TV Unit, Island, etc.)
- Length in millimeters (typically 1500-4000mm for benchtops)
- Width in millimeters (typically 400-900mm for benchtops)
- Shape: rectangular, L-shaped, U-shaped, or irregular
- Cutouts if marked: HP/hotplate, UMS/undermount sink, SR/drop-in sink, tap holes

CONFIDENCE SCORING:
- 0.9-1.0: Clear CAD with measurement lines
- 0.7-0.89: Visible but some ambiguity
- 0.5-0.69: Estimated from context
- Below 0.5: Flag for manual verification

OUTPUT FORMAT - Return ONLY valid JSON:
{
  "success": true,
  "drawingType": "cad_professional" or "job_sheet" or "hand_drawn" or "architectural",
  "metadata": {
    "jobNumber": "string or null",
    "defaultThickness": 20,
    "defaultOverhang": 10
  },
  "rooms": [
    {
      "name": "Kitchen",
      "pieces": [
        {
          "pieceNumber": 1,
          "name": "Island Bench",
          "pieceType": "benchtop",
          "shape": "rectangular",
          "length": 3600,
          "width": 900,
          "thickness": 20,
          "cutouts": [{"type": "hotplate"}, {"type": "sink"}],
          "notes": "any observations",
          "confidence": 0.85
        }
      ]
    }
  ],
  "warnings": ["list any issues"],
  "questionsForUser": ["questions needing clarification"]
}`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    let buffer: Buffer = Buffer.from(bytes);
    let mimeType = file.type || 'image/png';

    console.log(`Received image: ${file.name}, size: ${buffer.length} bytes, type: ${mimeType}`);

    // Check if compression is needed (>5MB or close to limit)
    if (buffer.length > MAX_IMAGE_SIZE * 0.8) {
      console.log(`Image size ${buffer.length} bytes exceeds threshold, compressing...`);
      try {
        const compressed = await compressImage(buffer, mimeType);
        buffer = compressed.data;
        mimeType = compressed.mediaType;
        console.log(`Compressed to ${buffer.length} bytes`);
      } catch (compressionError) {
        console.error('Image compression failed:', compressionError);
        return NextResponse.json(
          {
            error: 'Image too large and compression failed',
            details: `Original size: ${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB. Maximum allowed: 5MB. Please upload a smaller image or compress it before uploading.`,
          },
          { status: 400 }
        );
      }
    }

    // Final size check after compression
    if (buffer.length > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        {
          error: 'Image still too large after compression',
          details: `Compressed size: ${(buffer.length / 1024 / 1024).toFixed(1)}MB. Maximum allowed: 5MB. Please upload a lower resolution image.`,
        },
        { status: 400 }
      );
    }

    const base64Image = buffer.toString('base64');
    const mediaType = mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: 'Analyze this stone fabrication drawing and extract all piece specifications. Return only valid JSON.',
            },
          ],
        },
      ],
    });

    // Extract text response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = textContent.text;
    if (jsonStr.includes('```json')) {
      jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
    } else if (jsonStr.includes('```')) {
      jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
    }

    const rawAnalysis = JSON.parse(jsonStr) as RawAnalysis;

    // Transform to legacy format for frontend compatibility
    const legacyAnalysis = transformToLegacyFormat(rawAnalysis);

    return NextResponse.json({
      success: true,
      // Legacy format for current frontend
      analysis: legacyAnalysis,
      // Full analysis with new format (includes metadata, all rooms, warnings, questions)
      fullAnalysis: rawAnalysis,
      tokensUsed: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    });

  } catch (error) {
    console.error('Drawing analysis error:', error);

    // More detailed error response
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      {
        error: 'Failed to analyze drawing',
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}
