import Anthropic from '@anthropic-ai/sdk';
import {
  ClassificationResult,
  DrawingAnalysisResult,
} from '@/lib/types/drawing-analysis';
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  CLASSIFICATION_USER_PROMPT,
} from '@/lib/prompts/classification';

const anthropic = new Anthropic();
const MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Stage 1: Classify the document type
 */
export async function classifyDocument(
  imageBase64: string,
  mimeType: string
): Promise<ClassificationResult> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: CLASSIFICATION_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
            data: imageBase64,
          },
        },
        { type: 'text', text: CLASSIFICATION_USER_PROMPT },
      ],
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Clean up response (remove markdown code blocks if present)
  const jsonStr = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    return JSON.parse(jsonStr) as ClassificationResult;
  } catch {
    console.error('Failed to parse classification response:', text);
    return {
      category: 'MIXED',
      confidence: 0.5,
      reason: 'Failed to parse AI response',
    };
  }
}

/**
 * Full analysis pipeline (Stages 1-3)
 * Stage 2 and 3 implemented in prompts 2.2 and 2.3
 */
export async function analyzeDrawing(
  imageBase64: string,
  mimeType: string
): Promise<DrawingAnalysisResult> {
  // Stage 1: Classify
  const classification = await classifyDocument(imageBase64, mimeType);

  // Stages 2 & 3 will be added in subsequent prompts
  // For now, return classification with empty pieces
  return {
    documentCategory: classification.category,
    categoryConfidence: classification.confidence,
    pieces: [],
    clarificationQuestions: [],
    overallConfidence: 'LOW',
  };
}

/**
 * Helper to convert file to base64
 */
export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
