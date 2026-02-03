import Anthropic from '@anthropic-ai/sdk';
import {
  ClassificationResult,
  ClarificationQuestion,
  ConfidenceLevel,
  DocumentCategory,
  DrawingAnalysisResult,
  ExtractedPiece,
} from '@/lib/types/drawing-analysis';
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  CLASSIFICATION_USER_PROMPT,
} from '@/lib/prompts/classification';
import {
  JOB_SHEET_EXTRACTION_SYSTEM_PROMPT,
  JOB_SHEET_EXTRACTION_USER_PROMPT,
} from '@/lib/prompts/extraction-job-sheet';
import {
  HAND_DRAWN_EXTRACTION_SYSTEM_PROMPT,
  HAND_DRAWN_EXTRACTION_USER_PROMPT,
} from '@/lib/prompts/extraction-hand-drawn';
import {
  CAD_EXTRACTION_SYSTEM_PROMPT,
  CAD_EXTRACTION_USER_PROMPT,
} from '@/lib/prompts/extraction-cad';

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

function getExtractionPrompts(category: DocumentCategory): { system: string; user: string } {
  switch (category) {
    case 'JOB_SHEET':
      return {
        system: JOB_SHEET_EXTRACTION_SYSTEM_PROMPT,
        user: JOB_SHEET_EXTRACTION_USER_PROMPT,
      };
    case 'HAND_DRAWN':
      return {
        system: HAND_DRAWN_EXTRACTION_SYSTEM_PROMPT,
        user: HAND_DRAWN_EXTRACTION_USER_PROMPT,
      };
    case 'CAD_DRAWING':
      return {
        system: CAD_EXTRACTION_SYSTEM_PROMPT,
        user: CAD_EXTRACTION_USER_PROMPT,
      };
    default:
      // Use job sheet as default - most common
      return {
        system: JOB_SHEET_EXTRACTION_SYSTEM_PROMPT,
        user: JOB_SHEET_EXTRACTION_USER_PROMPT,
      };
  }
}

/**
 * Stage 2: Extract pieces based on document type
 */
export async function extractPieces(
  imageBase64: string,
  mimeType: string,
  category: DocumentCategory
): Promise<ExtractedPiece[]> {
  const prompts = getExtractionPrompts(category);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: prompts.system,
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
        { type: 'text', text: prompts.user },
      ],
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const result = JSON.parse(jsonStr);
    return result.pieces || [];
  } catch (error) {
    console.error('Failed to parse extraction response:', text);
    return [];
  }
}

function calculateOverallConfidence(pieces: ExtractedPiece[]): ConfidenceLevel {
  if (pieces.length === 0) return 'LOW';

  const confidences = pieces.map(p => p.extractionConfidence);
  const lowCount = confidences.filter(c => c === 'LOW').length;
  const highCount = confidences.filter(c => c === 'HIGH').length;

  if (lowCount > pieces.length / 2) return 'LOW';
  if (highCount > pieces.length / 2) return 'HIGH';
  return 'MEDIUM';
}

/**
 * Full analysis pipeline (Stages 1-3)
 */
export async function analyzeDrawing(
  imageBase64: string,
  mimeType: string
): Promise<DrawingAnalysisResult> {
  // Stage 1: Classify
  const classification = await classifyDocument(imageBase64, mimeType);

  // Stage 2: Extract pieces based on category
  const pieces = await extractPieces(imageBase64, mimeType, classification.category);

  // Stage 3: Generate clarifications (implemented in 2.3)
  const clarificationQuestions: ClarificationQuestion[] = [];

  // Calculate overall confidence
  const overallConfidence = calculateOverallConfidence(pieces);

  return {
    documentCategory: classification.category,
    categoryConfidence: classification.confidence,
    pieces,
    clarificationQuestions,
    overallConfidence,
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
