// src/domain/schema/parse.ts
// =============================================================================
// SCHEMA PARSING AND FORMATTING UTILITIES
// =============================================================================

import type { StructuredOutputSchema } from '../../shared';

/**
 * Format a schema object as pretty-printed JSON.
 */
export function formatSchema(schema: StructuredOutputSchema | null): string {
    if (!schema) return '';
    return JSON.stringify(schema, null, 2);
}

/**
 * Parse a structured output response.
 * Handles markdown code blocks and validates against schema.
 *
 * @param response - Raw LLM response
 * @param schema - Optional schema to validate against
 * @returns Parsed data with warnings, or null if parsing fails
 */
export function parseStructuredResponse(
    response: string,
    schema?: StructuredOutputSchema,
): { data: unknown; warnings: string[] } | null {
    let parsed: unknown;

    try {
        parsed = JSON.parse(response);
    } catch {
        // Try to extract JSON from markdown code blocks
        const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            try {
                parsed = JSON.parse(codeBlockMatch[1].trim());
            } catch {
                return null;
            }
        } else {
            return null;
        }
    }

    const warnings: string[] = [];

    // If schema provided, validate required fields
    if (
        schema &&
        schema.value.required &&
        Array.isArray(schema.value.required)
    ) {
        const missing = schema.value.required.filter(
            (field) => !(field in (parsed as Record<string, unknown>)),
        );

        if (missing.length > 0) {
            warnings.push(`Missing required fields: ${missing.join(', ')}`);
        }
    }

    return { data: parsed, warnings };
}
