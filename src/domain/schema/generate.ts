// src/domain/schema/generate.ts
// =============================================================================
// LLM-BASED SCHEMA GENERATION
// =============================================================================

import { validateSchema } from './validate';
import { autoFixSchema } from './auto-fix';

const SCHEMA_GENERATION_PROMPT = `Generate a JSON Schema for structured LLM output based on the user's description.

Example input: "rating 1-10, list of issues, summary"
Example output: {"name": "Analysis", "strict": true, "value": {"type": "object", "additionalProperties": false, "properties": {"rating": {"type": "number"}, "issues": {"type": "array", "items": {"type": "string"}}, "summary": {"type": "string"}}, "required": ["rating", "issues", "summary"]}}

Requirements:
- Output ONLY valid JSON, no markdown, no explanation
- Use this exact wrapper format: {"name": "SchemaName", "strict": true, "value": {...}}
- The "value" must be a valid JSON Schema with "type": "object"
- Add "additionalProperties": false to ALL object types (required for Anthropic)
- All object properties should be in a "required" array unless explicitly optional
- Use simple types: string, number, integer, boolean, array, object
- For arrays, always specify "items" with a schema
- Keep it minimal - only what the user asked for

User's description:`;

/**
 * Generate a JSON schema from a natural language description.
 *
 * This uses the LLM to generate a schema based on the user's description,
 * then validates and auto-fixes it.
 *
 * @example
 * ```ts
 * const result = await generateSchemaFromDescription(
 *   'rating 1-10, list of strengths, list of weaknesses, summary'
 * );
 *
 * if (result.success) {
 *   console.log(result.schema); // Pretty-printed JSON schema
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export async function generateSchemaFromDescription(
    description: string,
): Promise<{
    success: boolean;
    schema?: string;
    error?: string;
}> {
    // Use generateSimple from generation module
    const { generateSimple } = await import('../generation');

    if (!description.trim()) {
        return {
            success: false,
            error: 'Please describe what you want in the schema',
        };
    }

    try {
        const response = await generateSimple(
            `${SCHEMA_GENERATION_PROMPT}\n\n${description}`,
            'You are a JSON Schema expert. Output only valid JSON, nothing else.',
        );

        if (!response) {
            return {
                success: false,
                error: 'Generation failed - no response received',
            };
        }

        // Clean up response - strip markdown code blocks if present
        let cleaned = response.trim();
        if (cleaned.startsWith('```')) {
            cleaned = cleaned
                .replace(/^```(?:json)?\s*/, '')
                .replace(/\s*```$/, '');
        }

        // Validate what we got
        const validation = validateSchema(cleaned);

        if (!validation.valid) {
            return {
                success: false,
                error: `Generated schema is invalid: ${validation.error}`,
                schema: cleaned, // Return it anyway so user can fix
            };
        }

        // Auto-fix if needed (adds additionalProperties: false, etc.)
        if (validation.warnings?.length) {
            const fixed = autoFixSchema(validation.schema!);
            return {
                success: true,
                schema: JSON.stringify(fixed, null, 2),
            };
        }

        return {
            success: true,
            schema: JSON.stringify(validation.schema, null, 2),
        };
    } catch (e) {
        return {
            success: false,
            error: `Generation failed: ${(e as Error).message}`,
        };
    }
}
