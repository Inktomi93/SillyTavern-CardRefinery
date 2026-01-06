// src/domain/character/summary.ts
// =============================================================================
// CHARACTER SUMMARY BUILDING
// =============================================================================

import { escapeSTMacros, replaceCharMacro } from '../../shared';
import type { Character, FieldSelection } from '../../types';
import { getPopulatedFields } from './fields';

/**
 * Build character summary from selected fields.
 *
 * Escapes ST macros so they don't get replaced during generation.
 */
export function buildCharacterSummary(
    char: Character,
    selection: FieldSelection,
): string {
    const fields = getPopulatedFields(char);
    const sections: string[] = [];

    for (const field of fields) {
        const sel = selection[field.key];
        if (!sel) continue;

        if (field.key === 'alternate_greetings' && Array.isArray(sel)) {
            // Specific greeting indices selected
            const greetings = field.rawValue as string[];
            const selected = (sel as number[])
                .filter((i) => i >= 0 && i < greetings.length)
                .map((i) => `**Greeting ${i + 1}:**\n${greetings[i].trim()}`)
                .join('\n\n');

            if (selected) {
                sections.push(`### ${field.label}\n\n${selected}`);
            }
        } else {
            sections.push(`### ${field.label}\n\n${field.value}`);
        }
    }

    const body =
        sections.length > 0 ? sections.join('\n\n') : '(No fields selected)';

    let summary = `# CHARACTER: ${char.name}\n\n${body}`;

    // Replace {{char}} with the actual character name
    summary = replaceCharMacro(summary, char.name);

    // Escape other ST macros to prevent replacement during generation
    summary = escapeSTMacros(summary);

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
