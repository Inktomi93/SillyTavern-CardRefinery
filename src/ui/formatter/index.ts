// src/ui/formatter/index.ts
// =============================================================================
// HYBRID RESPONSE FORMATTER
//
// Renders both JSON and markdown responses with consistent, polished styling.
// Detects structure patterns in markdown (sections, scores, lists) and renders
// them with the same visual treatment as structured JSON output.
// =============================================================================

import type { StructuredOutputSchema } from '../../types';
import { parseMarkdownSections } from './markdown-parser';
import { renderSections } from './section-renderer';
import { inferSchema, renderStructuredRoot } from './json-renderer';

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Format any response (auto-detects JSON vs markdown)
 */
export function formatResponse(response: string): string {
    const { DOMPurify } = SillyTavern.libs;
    const text =
        typeof response === 'string' ? response : String(response ?? '');

    // Try JSON first
    const parsed = parseStructuredResponse(text);
    if (parsed && typeof parsed === 'object') {
        return formatStructuredResponse(text, null);
    }

    // Parse markdown into structured sections
    const sections = parseMarkdownSections(text);
    const html = renderSections(sections);

    return DOMPurify.sanitize(html);
}

/**
 * Format a structured JSON response with smart rendering
 */
export function formatStructuredResponse(
    response: string,
    schema: StructuredOutputSchema | null,
): string {
    const { DOMPurify } = SillyTavern.libs;
    const text =
        typeof response === 'string' ? response : String(response ?? '');

    const parsed = parseStructuredResponse(text);

    if (!parsed || typeof parsed !== 'object') {
        // Fall back to markdown parsing
        const sections = parseMarkdownSections(text);
        return DOMPurify.sanitize(renderSections(sections));
    }

    const schemaValue = schema?.value ?? inferSchema(parsed);
    const html = renderStructuredRoot(
        parsed as Record<string, unknown>,
        schemaValue,
    );

    return DOMPurify.sanitize(html);
}

/**
 * Parse a structured response (handles JSON and code blocks)
 */
export function parseStructuredResponse(response: string): unknown | null {
    try {
        return JSON.parse(response);
    } catch {
        // Try to extract JSON from markdown code blocks
        const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            try {
                return JSON.parse(codeBlockMatch[1].trim());
            } catch {
                return null;
            }
        }
        return null;
    }
}

// =============================================================================
// RE-EXPORTS FOR INTERNAL USE
// =============================================================================

// Types
export type { ParsedSection, ScoreMatch, ExtractedList } from './types';

// For components that need direct access
export { renderSections } from './section-renderer';
export { formatInlineContent } from './section-renderer';
