// src/ui/components/apply-suggestions/helpers.ts
// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

import { getTokenCountsKeyed } from '../../../shared';
import { formatTokenCount } from '../base';
import type { CharacterField, PopulatedField } from '../../../types';

// =============================================================================
// FIELD FORMATTING
// =============================================================================

/**
 * Format a field value for display/editing in textarea.
 * Different from formatValue in fields.ts - this is for editable content.
 */
export function formatFieldForEditing(field: PopulatedField): string {
    const { rawValue, type, key } = field;

    if (rawValue === undefined || rawValue === null) {
        return '';
    }

    // Arrays: join with separator
    if (type === 'array' && Array.isArray(rawValue)) {
        return rawValue.join('\n---\n');
    }

    // Objects: special handling based on field type
    if (type === 'object') {
        if (key === 'depth_prompt') {
            const dp = rawValue as { prompt?: string };
            return dp.prompt || '';
        }
        if (key === 'character_book') {
            // Character book is complex - show as read-only JSON for now
            // Could be enhanced to show individual entries
            try {
                return JSON.stringify(rawValue, null, 2);
            } catch {
                return '[Character Lorebook - edit in ST]';
            }
        }
        try {
            return JSON.stringify(rawValue, null, 2);
        } catch {
            return '';
        }
    }

    return String(rawValue);
}

/**
 * Check if a field type is editable in the apply dialog.
 * Some complex fields like character_book are better edited in ST directly.
 */
export function isEditableFieldType(field: CharacterField): boolean {
    // Character book is too complex for simple textarea editing
    if (field.key === 'character_book') {
        return false;
    }
    return true;
}

// =============================================================================
// TOKEN COUNTING
// =============================================================================

/**
 * Load and display token counts for apply dialog fields.
 * Called after the dialog renders to async update the badges.
 */
export async function loadApplyDialogTokens(
    fieldMap: Map<string, PopulatedField>,
): Promise<void> {
    // Collect items to count
    const items: Array<{ key: string; text: string }> = [];

    for (const [key, field] of fieldMap) {
        if (key === 'alternate_greetings') continue; // Handled separately
        const text = formatFieldForEditing(field);
        if (text) {
            items.push({ key, text });
        }
    }

    if (items.length === 0) return;

    const results = await getTokenCountsKeyed(items);

    // Update badges in the DOM
    for (const { key, tokens } of results) {
        const badge = document.querySelector(
            `.cr-apply-field__tokens[data-field="${key}"]`,
        );
        if (badge && tokens !== null) {
            badge.textContent = `${formatTokenCount(tokens)} tokens`;
        }
    }
}
