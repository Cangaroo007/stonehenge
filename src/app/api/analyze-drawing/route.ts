import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
- Job Number (look for "Job No." field)
- Default Thickness (usually 20mm or 40mm)
- Default Overhang (usually 10mm)
- Material/Color if specified

For Each Stone Piece:
- Piece number if marked (circled numbers like 1, 2, 3, 4)
- Room/area label (Kitchen, Bathroom, Pantry, Laundry, TV Unit, Island, etc.)
- Length in millimeters (typically 1500-4000mm for benchtops)
- Width in millimeters (typically 400-900mm for benchtops)
- Shape: rectangular, L-shaped, U-shaped, or irregular
- For L-shaped: report bounding dimensions AND describe the shape
- Cutouts if marked: HP=hotplate, UMS=undermount sink, SR=drop-in sink

HOW TO READ DIMENSIONS:
- Numbers are in millimeters (2615.0 = 2615mm = 2.615m)
- Dimension lines have arrows/ticks at each end
- CAD drawings have precise decimals (2615.0)
- Hand-drawn may have rounded numbers (2600)

CONFIDENCE SCORING:
- 0.9-1.0: Clear CAD with measurement lines
- 0.7-0.89: Visible but some ambiguity
- 0.5-0.69: Estimated from context
- Below 0.5: Guessing - flag for verification

OUTPUT FORMAT - Return ONLY valid JSON (no markdown, no explanation):
{
  "success": true,
  "drawingType": "cad_professional" | "job_sheet" | "hand_drawn" | "architectural",
  "metadata": {
    "jobNumber": "string or null",
    "defaultThickness": 20,
    "defaultOverhang": 10,
    "material": "string or null"
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
          "shapeNotes": "null or description for complex shapes",
          "cutouts": [{"type": "sink", "notes": "undermount"}],
          "notes": "any observations",
          "confidence": 0.85
        }
      ]
    }
  ],
  "warnings": ["list any issues or uncertainties"],
  "questionsForUser": ["questions needing human clarification"]
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
    let buffer = Buffer.from(bytes);
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

    const analysis = JSON.parse(jsonStr);

    return NextResponse.json({
      success: true,
      analysis,
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
