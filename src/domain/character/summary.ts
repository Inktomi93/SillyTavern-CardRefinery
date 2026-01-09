// src/domain/character/summary.ts
// =============================================================================
// CHARACTER SUMMARY BUILDING
// =============================================================================

import {
    escapeSTMacros,
    replaceCharMacro,
    replaceUserMacro,
} from '../../shared/templates';
import { getSettings } from '../../data/settings';
import type { Character, FieldSelection } from '../../types';
import { getPopulatedFields } from './fields';

// =============================================================================
// LOREBOOK FORMATTING
// =============================================================================

interface LorebookEntry {
    id?: number;
    name?: string;
    comment?: string;
    keys?: string[];
    secondary_keys?: string[];
    content?: string;
    enabled?: boolean;
}

/**
 * Format selected lorebook entries for LLM consumption.
 * Only includes fields relevant for analysis (id, keys, secondary_keys, comment, content).
 * Excludes ST-internal fields like extensions, position, insertion_order, etc.
 */
function formatLorebookForLLM(
    bookName: string | undefined,
    bookDescription: string | undefined,
    entries: LorebookEntry[],
): string {
    const sections: string[] = [];

    // Header
    if (bookName) {
        sections.push(`## Lorebook: ${bookName}`);
    } else {
        sections.push('## Character Lorebook');
    }
    if (bookDescription) {
        sections.push(bookDescription);
    }
    sections.push(`Selected Entries: ${entries.length}`);
    sections.push('');

    // Format each entry with LLM-relevant fields only
    for (const entry of entries) {
        const title = entry.name || entry.comment || `Entry ${entry.id ?? '?'}`;
        const status = entry.enabled !== false ? 'Active' : 'Inactive';

        sections.push(`### ${title}`);
        if (entry.id !== undefined) {
            sections.push(`ID: ${entry.id}`);
        }
        sections.push(`Status: ${status}`);

        if (entry.keys?.length) {
            sections.push(`Keys: ${entry.keys.join(', ')}`);
        }
        if (entry.secondary_keys?.length) {
            sections.push(`Secondary Keys: ${entry.secondary_keys.join(', ')}`);
        }

        sections.push('');
        sections.push('Content:');
        sections.push(entry.content?.trim() || '(empty)');
        sections.push('');
    }

    return sections.join('\n');
}

// =============================================================================
// CHARACTER SUMMARY
// =============================================================================

/**
 * Build character summary from selected fields.
 *
 * Handles macro replacement based on settings:
 * - {{char}} is always replaced with character name
 * - {{user}} is replaced with persona name if replaceUserMacro setting is enabled
 * - Other ST macros are escaped to prevent replacement during generation
 */
export function buildCharacterSummary(
    char: Character,
    selection: FieldSelection,
): string {
    const settings = getSettings();
    const fields = getPopulatedFields(char);
    const sections: string[] = [];

    for (const field of fields) {
        const sel = selection[field.key];
        if (!sel) continue;

        // Handle alternate_greetings - individual greeting selection
        if (field.key === 'alternate_greetings' && Array.isArray(sel)) {
            const greetings = field.rawValue as string[];
            const selected = (sel as number[])
                .filter((i) => i >= 0 && i < greetings.length)
                .map((i) => `**Greeting ${i + 1}:**\n${greetings[i].trim()}`)
                .join('\n\n');

            if (selected) {
                sections.push(`### ${field.label}\n\n${selected}`);
            }
            continue;
        }

        // Handle character_book - individual entry selection
        if (field.key === 'character_book' && Array.isArray(sel)) {
            const book = field.rawValue as {
                name?: string;
                description?: string;
                entries?: Array<{
                    id?: number;
                    name?: string;
                    comment?: string;
                    keys?: string[];
                    secondary_keys?: string[];
                    content?: string;
                    enabled?: boolean;
                }>;
            };
            const entries = book.entries || [];
            const selectedEntries = (sel as number[])
                .filter((i) => i >= 0 && i < entries.length)
                .map((i) => entries[i]);

            if (selectedEntries.length > 0) {
                const formatted = formatLorebookForLLM(
                    book.name,
                    book.description,
                    selectedEntries,
                );
                sections.push(`### ${field.label}\n\n${formatted}`);
            }
            continue;
        }

        // Default: use pre-formatted value
        sections.push(`### ${field.label}\n\n${field.value}`);
    }

    const body =
        sections.length > 0 ? sections.join('\n\n') : '(No fields selected)';

    let summary = `# CHARACTER: ${char.name}\n\n${body}`;

    // Replace {{char}} with the actual character name
    summary = replaceCharMacro(summary, char.name);

    // Handle {{user}} macro based on setting
    if (settings.replaceUserMacro) {
        // Replace {{user}} with current persona name for context-aware analysis
        summary = replaceUserMacro(summary);
        // Escape remaining ST macros (persona, original, input, etc.)
        summary = escapeSTMacros(summary, ['persona', 'original', 'input']);
    } else {
        // Escape all ST macros including {{user}}
        summary = escapeSTMacros(summary);
    }

    return summary;
}

/**
 * Build original data snapshot for session storage.
 */
export function buildOriginalData(
    char: Character,
    selection: FieldSelection,
): Record<string, string> {
    const fields = getPopulatedFields(char);
    const data: Record<string, string> = {};

    for (const field of fields) {
        if (selection[field.key]) {
            data[field.key] = field.value;
        }
    }

    return data;
}
