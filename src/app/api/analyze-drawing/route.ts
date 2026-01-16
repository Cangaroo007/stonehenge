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
              text: `You are analyzing an architectural drawing or floor plan for a stone benchtop fabrication quote. 

Please extract the following information and return it as JSON:

1. **roomType**: The type of room shown (Kitchen, Bathroom, Ensuite, Laundry, Pantry, Butler's Pantry, Powder Room, or "Unknown" if unclear)
2. **confidence**: Your confidence in the room type detection ("high", "medium", or "low")
3. **pieces**: An array of stone benchtop pieces you can identify. For each piece include:
   - description: What the piece is (e.g., "Main Benchtop", "Island Bench", "Splashback", "Vanity Top")
   - lengthMm: Length in millimeters (estimate from drawing scale if shown, otherwise use reasonable default like 2000mm for kitchen benchtops, 900mm for vanities)
   - widthMm: Width/depth in millimeters (typically 600mm for kitchen benchtops, 500mm for vanities, 100mm for splashbacks)
   - thicknessMm: Suggested thickness (20, 30, or 40mm - default 20mm)
   - notes: Any relevant notes about the piece

Look for:
- Benchtop outlines and dimensions
- Islands or peninsulas
- Splashbacks
- Vanity tops
- Any dimension annotations on the drawing

If you cannot identify specific dimensions, make reasonable estimates based on typical Australian residential standards.

Return ONLY valid JSON in this exact format:
{
  "roomType": "Kitchen",
  "confidence": "high",
  "roomTypeReasoning": "Brief explanation of why you identified this room type",
  "pieces": [
    {
      "description": "Main Benchtop",
      "lengthMm": 3000,
      "widthMm": 600,
      "thicknessMm": 20,
      "notes": "L-shaped configuration"
    }
  ],
  "drawingNotes": "Any other relevant observations about the drawing"
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
