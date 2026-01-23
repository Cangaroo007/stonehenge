import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');

    // Determine media type
    const mimeType = file.type || 'image/png';
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
