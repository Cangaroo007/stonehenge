import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    
    // Determine media type and content type
    const mediaType = file.type;
    const isPdf = mediaType === 'application/pdf';
    const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType);
    
    if (!isPdf && !isImage) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a PDF, JPEG, PNG, GIF, or WebP file.' },
        { status: 400 }
      );
    }

    // Build the content block based on file type
    const fileContent = isPdf
      ? {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: base64,
          },
        }
      : {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: base64,
          },
        };

    // Call Claude API to analyze the drawing
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            fileContent,
            {
              type: 'text',
              text: `You are an expert at analyzing architectural drawings and floor plans for stone benchtop fabrication quotes. Your goal is to extract accurate dimensions and identify all stone pieces needed.

## SCALE DETECTION (Critical - Do This First)
1. Look for a scale bar, scale notation (e.g., "1:50", "1:100", "Scale 1:20"), or reference dimensions
2. If found, use it to calculate all other dimensions accurately
3. If no scale is found, look for standard reference objects (doors are typically 820mm wide, standard base cabinets are 600mm deep)

## EXTRACTION REQUIREMENTS

### Room Identification
- Identify the room type: Kitchen, Bathroom, Ensuite, Laundry, Pantry, Butler's Pantry, Powder Room, or "Unknown"
- Provide confidence level and reasoning

### Pieces to Extract
For EACH stone piece, extract:
1. **Benchtops**: Main work surfaces, islands, peninsulas
2. **Splashbacks**: Measure as LINEAR LENGTH × HEIGHT (not depth). Standard heights: 600mm (full), 150mm (upstand)
3. **Vanity tops**: Bathroom/ensuite surfaces
4. **Waterfall ends**: Vertical drops on islands/benchtops
5. **Window sills**: If stone is specified

### Per-Piece Information Required
- description: Clear name (e.g., "Main Benchtop - Left Section", "Island Bench", "Full Height Splashback")
- lengthMm: Length in millimeters
- widthMm: Width/depth in millimeters (for splashbacks, this is the HEIGHT)
- thicknessMm: 20, 30, or 40mm (default 20mm, islands often 40mm)
- dimensionConfidence: "measured" (from drawing), "scaled" (calculated from scale), or "estimated" (best guess)
- pieceType: "benchtop", "splashback", "vanity", "waterfall", "sill", or "other"
- isComplexShape: true if L-shaped, U-shaped, or has angles (may need to be split for fabrication)
- notes: Any relevant observations

### Cutouts to Detect
Look for symbols or annotations indicating:
- Sink cutouts (undermount, top-mount, butler sink)
- Cooktop/hob cutouts
- Tap holes
- Power outlet cutouts
- Other penetrations

### Edge Profiles to Detect
Look for edge detail callouts:
- Square/Straight
- Bullnose
- Beveled/Chamfered
- Ogee
- Pencil round
- Waterfall (vertical continuation)
- Mitred edges

## IMPORTANT GUIDELINES
1. If a piece is L-shaped or U-shaped, note this in isComplexShape and consider if it should be listed as multiple pieces
2. For splashbacks, widthMm should be the HEIGHT (e.g., 600mm for full height, 150mm for upstand)
3. Always specify dimensionConfidence - never assume "measured" unless you can see the actual dimension annotation
4. If dimensions seem unrealistic (e.g., benchtop over 4000mm), flag in notes as may need joining

## OUTPUT FORMAT
Return ONLY valid JSON:
{
  "roomType": "Kitchen",
  "roomTypeConfidence": "high",
  "roomTypeReasoning": "Identified by sink, cooktop, and cabinet layout typical of kitchen",
  "scaleDetected": "1:50",
  "scaleSource": "Scale bar in bottom right corner",
  "pieces": [
    {
      "description": "Main Benchtop - L-shaped",
      "lengthMm": 3200,
      "widthMm": 600,
      "thicknessMm": 20,
      "dimensionConfidence": "scaled",
      "pieceType": "benchtop",
      "isComplexShape": true,
      "edgeProfile": "square",
      "notes": "L-shaped configuration, may need to be fabricated as 2 pieces"
    },
    {
      "description": "Full Height Splashback",
      "lengthMm": 2400,
      "widthMm": 600,
      "thicknessMm": 20,
      "dimensionConfidence": "scaled",
      "pieceType": "splashback",
      "isComplexShape": false,
      "edgeProfile": null,
      "notes": "Behind cooktop area"
    }
  ],
  "cutouts": [
    {
      "type": "sink",
      "subtype": "undermount",
      "quantity": 1,
      "associatedPiece": "Main Benchtop - L-shaped",
      "notes": "Standard undermount sink"
    },
    {
      "type": "cooktop",
      "subtype": "induction",
      "quantity": 1,
      "associatedPiece": "Main Benchtop - L-shaped",
      "notes": "900mm cooktop"
    },
    {
      "type": "tapHole",
      "subtype": null,
      "quantity": 1,
      "associatedPiece": "Main Benchtop - L-shaped",
      "notes": null
    }
  ],
  "edgeProfiles": [
    {
      "profile": "waterfall",
      "location": "Island bench - left end",
      "lengthMm": 900
    }
  ],
  "drawingNotes": "Clear floor plan with good dimension annotations. Scale bar provided.",
  "warnings": ["L-shaped benchtop exceeds standard slab width, will require join"]
}`,
            },
          ],
        },
      ],
    });

    // Extract the text response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    // Parse the JSON response
    let analysisResult;
    try {
      // Extract JSON from the response (handle potential markdown code blocks)
      let jsonStr = textContent.text;
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      analysisResult = JSON.parse(jsonStr);
    } catch {
      console.error('Failed to parse AI response:', textContent.text);
      return NextResponse.json(
        { error: 'Failed to parse AI response', rawResponse: textContent.text },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analysis: analysisResult,
    });
  } catch (error) {
    console.error('Drawing analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze drawing' },
      { status: 500 }
    );
  }
}
