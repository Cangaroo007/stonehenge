import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();
const MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Service category enums matching our database schema
 */
export enum ServiceCategory {
  SLAB = 'SLAB',
  CUTTING = 'CUTTING',
  POLISHING = 'POLISHING',
  CUTOUT = 'CUTOUT',
  DELIVERY = 'DELIVERY',
  INSTALLATION = 'INSTALLATION',
}

export enum CutoutType {
  HOTPLATE = 'HOTPLATE',
  GPO = 'GPO',
  TAP_HOLE = 'TAP_HOLE',
  DROP_IN_SINK = 'DROP_IN_SINK',
  UNDERMOUNT_SINK = 'UNDERMOUNT_SINK',
  FLUSH_COOKTOP = 'FLUSH_COOKTOP',
  BASIN = 'BASIN',
  DRAINER_GROOVES = 'DRAINER_GROOVES',
  OTHER = 'OTHER',
}

/**
 * Price mapping structure returned by AI
 */
export interface PriceMapping {
  // Original data from spreadsheet
  originalCategory: string;
  originalName: string;
  originalRate: number;
  originalUnit?: string;

  // Mapped to our internal system
  serviceCategory: ServiceCategory;
  cutoutType?: CutoutType; // Only for CUTOUT category
  
  // Standardized pricing
  rate20mm?: number; // For thickness-specific services
  rate40mm?: number;
  ratePerLinearMetre?: number;
  ratePerSquareMetre?: number;
  fixedRate?: number;
  
  // Metadata
  unit: 'Metre' | 'Millimetre' | 'Square Metre' | 'Fixed'; // Australian spelling
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
}

/**
 * AI interpretation result
 */
export interface InterpretationResult {
  mappings: PriceMapping[];
  summary: {
    totalItems: number;
    categoryCounts: Record<ServiceCategory, number>;
    averageConfidence: number;
    warnings: string[];
  };
  rawData: string; // Original file content for debugging
}

const AI_SYSTEM_PROMPT = `You are a pricing data interpreter for a stone fabrication business. Your job is to analyze uploaded price lists (spreadsheets) and map them to our internal pricing categories.

# Internal Categories (ENUMS):
- SLAB: Material/slab pricing
- CUTTING: Cutting services (usually per linear metre)
- POLISHING: Edge polishing (per linear metre, may have thickness variations)
- CUTOUT: Cutouts like sinks, cooktops, tap holes (usually fixed price per item)
- DELIVERY: Delivery charges
- INSTALLATION: Installation services

# Cutout Types (if category is CUTOUT):
- HOTPLATE, GPO, TAP_HOLE, DROP_IN_SINK, UNDERMOUNT_SINK, FLUSH_COOKTOP, BASIN, DRAINER_GROOVES, OTHER

# Australian Standards:
- ALL units must use Australian spelling: "Metre" (not "Meter"), "Millimetre" (not "Millimeter")
- Prices are in AUD ($)

# Mapping Rules:
1. Analyze headers and row data to understand the pricing structure
2. Map each row to ONE of our service categories
3. For thickness-specific rates (20mm, 40mm), populate both rate20mm and rate40mm
4. Convert all measurements to metres if needed (e.g., "1000mm" → "1 Metre")
5. Standardize units: "lm", "lin m", "linear meter" → "Metre"
6. Mark confidence: high (obvious match), medium (reasonable guess), low (unclear)
7. Add notes for any ambiguities or special handling needed

# Common Mappings:
- "Sink hole", "Cooktop cutout" → CUTOUT
- "Edge polish", "Polished edge" → POLISHING
- "Cutting", "Cut line" → CUTTING
- "Material", "Slab cost" → SLAB
- "Install", "Fitting" → INSTALLATION
- "Freight", "Transport" → DELIVERY

Return a JSON array of PriceMapping objects.`;

const AI_USER_PROMPT = (fileContent: string) => `Please analyze this price list data and map it to our internal categories:

\`\`\`
${fileContent}
\`\`\`

Return ONLY a valid JSON array following the PriceMapping interface structure. Do not include any markdown formatting or explanatory text.`;

/**
 * Main function to interpret a price list file
 * @param fileData - String content of the uploaded file (CSV or parsed Excel)
 * @returns Interpreted price mappings
 */
export async function interpretPriceList(
  fileData: string
): Promise<InterpretationResult> {
  try {
    // Call Anthropic API
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: AI_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: AI_USER_PROMPT(fileData),
        },
      ],
    });

    // Extract text from response
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in AI response');
    }

    // Parse JSON response (using Railway-safe double-cast pattern)
    let mappings: PriceMapping[];
    try {
      const parsed = JSON.parse(textContent.text);
      mappings = parsed as unknown as PriceMapping[];
    } catch (parseError) {
      throw new Error(
        `Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
      );
    }

    // Validate and normalize mappings
    const validatedMappings = mappings.map((mapping) => ({
      ...mapping,
      // Ensure Australian spelling for units
      unit: normalizeUnit(mapping.unit),
    }));

    // Calculate summary statistics
    const categoryCounts: Record<ServiceCategory, number> = {
      [ServiceCategory.SLAB]: 0,
      [ServiceCategory.CUTTING]: 0,
      [ServiceCategory.POLISHING]: 0,
      [ServiceCategory.CUTOUT]: 0,
      [ServiceCategory.DELIVERY]: 0,
      [ServiceCategory.INSTALLATION]: 0,
    };

    let totalConfidence = 0;
    const warnings: string[] = [];

    validatedMappings.forEach((mapping) => {
      categoryCounts[mapping.serviceCategory]++;
      
      // Calculate confidence score (high=1, medium=0.5, low=0.25)
      totalConfidence += mapping.confidence === 'high' ? 1 : mapping.confidence === 'medium' ? 0.5 : 0.25;
      
      // Collect warnings for low-confidence mappings
      if (mapping.confidence === 'low') {
        warnings.push(
          `Low confidence mapping: "${mapping.originalName}" → ${mapping.serviceCategory}`
        );
      }
    });

    const averageConfidence = totalConfidence / validatedMappings.length;

    return {
      mappings: validatedMappings,
      summary: {
        totalItems: validatedMappings.length,
        categoryCounts,
        averageConfidence,
        warnings,
      },
      rawData: fileData,
    };
  } catch (error) {
    console.error('Error interpreting price list:', error);
    throw new Error(
      `Failed to interpret price list: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Normalize unit to Australian spelling
 */
function normalizeUnit(
  unit: string
): 'Metre' | 'Millimetre' | 'Square Metre' | 'Fixed' {
  const normalized = unit.toLowerCase().trim();
  
  if (normalized.includes('square') || normalized.includes('sqm') || normalized.includes('m²')) {
    return 'Square Metre';
  }
  
  if (normalized.includes('milli') || normalized === 'mm') {
    return 'Millimetre';
  }
  
  if (
    normalized === 'metre' ||
    normalized === 'meter' ||
    normalized === 'm' ||
    normalized.includes('linear')
  ) {
    return 'Metre';
  }
  
  return 'Fixed';
}

/**
 * Helper function to parse CSV content
 * (Can be called from frontend before sending to API)
 */
export function parseCSV(csvContent: string): string[][] {
  const lines = csvContent.split('\n').filter((line) => line.trim());
  return lines.map((line) =>
    line.split(',').map((cell) => cell.trim().replace(/^["']|["']$/g, ''))
  );
}

/**
 * Helper to format parsed data for AI consumption
 */
export function formatDataForAI(data: string[][]): string {
  if (data.length === 0) return '';
  
  const headers = data[0];
  const rows = data.slice(1);
  
  let formatted = 'Headers: ' + headers.join(' | ') + '\n\n';
  formatted += 'Rows:\n';
  
  rows.forEach((row, idx) => {
    formatted += `${idx + 1}. ${row.join(' | ')}\n`;
  });
  
  return formatted;
}
