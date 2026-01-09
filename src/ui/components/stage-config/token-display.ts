// src/ui/components/stage-config/token-display.ts
// =============================================================================
// TOKEN DISPLAY & COUNTING
// =============================================================================

import {
    MODULE_NAME,
    getTokenCount,
    getTokenCountsKeyed,
    getApiStatus,
} from '../../../shared';
import { getState, getCurrentFieldSelection } from '../../../state';
import { getSettings } from '../../../data';
import { $, formatTokenCount } from '../base';
import { fieldTokenCounts } from './state';
import type { PopulatedField, CharacterBookEntry } from '../../../types';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Fields with per-entry selection that need individual token counting */
const EXPANDABLE_FIELDS = ['alternate_greetings', 'character_book'] as const;

// =============================================================================
// FIELD TOKEN LOADING
// =============================================================================

/**
 * Load token counts for fields and update the display.
 * Handles both simple fields and expandable fields with per-entry counting.
 */
export async function loadFieldTokens(fields: PopulatedField[]): Promise<void> {
    const items: Array<{ key: string; text: string }> = [];

    for (const field of fields) {
        if (
            field.key === 'alternate_greetings' &&
            Array.isArray(field.rawValue)
        ) {
            // Per-entry counting for alternate greetings
            const greetings = field.rawValue as string[];
            for (let i = 0; i < greetings.length; i++) {
                items.push({
                    key: `${field.key}:${i}`,
                    text: greetings[i],
                });
            }
        } else if (field.key === 'character_book' && field.rawValue) {
            // Per-entry counting for lorebook entries
            const book = field.rawValue as { entries?: CharacterBookEntry[] };
            const entries = book.entries || [];
            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                // Lorebook entry content is the main text
                const text = entry.content || '';
                items.push({
                    key: `${field.key}:${i}`,
                    text,
                });
            }
        } else {
            // Simple field - whole field token count
            items.push({ key: field.key, text: field.value });
        }
    }

    if (items.length === 0) return;

    const results = await getTokenCountsKeyed(items);

    // Update each token display element and store counts
    for (const { key, tokens } of results) {
        if (tokens !== null) {
            fieldTokenCounts.set(key, tokens);
        }
        // Only update display elements for simple fields (expandable don't have per-item displays)
        if (!key.includes(':')) {
            const el = $(`.cr-field-tokens[data-field="${key}"]`);
            if (el) {
                el.textContent = formatTokenCount(tokens);
            }
        }
    }

    // Update total
    updateFieldTotal();
}

// =============================================================================
// FIELD TOTAL DISPLAY
// =============================================================================

/**
 * Update the total token count for selected fields.
 * Also shows a warning in rewrite stage if max output < character tokens.
 */
export function updateFieldTotal(): void {
    const totalEl = $(`#${MODULE_NAME}_field_total`);
    if (!totalEl) return;

    const selection = getCurrentFieldSelection();
    let total = 0;
    let selectedCount = 0;

    // Count tokens from simple fields (keys without ":")
    for (const [key, tokens] of fieldTokenCounts) {
        // Skip expandable field entries (they have ":" in the key)
        if (key.includes(':')) continue;

        const isSelected = key in selection && selection[key] !== false;
        if (isSelected) {
            total += tokens;
            selectedCount++;
        }
    }

    // Count tokens from expandable fields based on selected indices
    for (const fieldKey of EXPANDABLE_FIELDS) {
        if (!(fieldKey in selection)) continue;

        const selectionValue = selection[fieldKey];
        if (!Array.isArray(selectionValue) || selectionValue.length === 0)
            continue;

        // Count this field as selected
        selectedCount++;

        // Sum tokens for selected entries
        for (const index of selectionValue as number[]) {
            const entryKey = `${fieldKey}:${index}`;
            const entryTokens = fieldTokenCounts.get(entryKey);
            if (entryTokens !== undefined) {
                total += entryTokens;
            }
        }
    }

    if (selectedCount === 0) {
        totalEl.textContent = 'none';
    } else {
        totalEl.textContent = `${selectedCount} fields, ~${total.toLocaleString()}t`;
    }

    // Check for token warning in rewrite stage
    updateTokenWarning(total);
}

// =============================================================================
// TOKEN WARNING
// =============================================================================

/**
 * Show/hide token warning based on max output vs character tokens.
 * Only applies to rewrite stage.
 */
export function updateTokenWarning(characterTokens: number): void {
    const warningEl = $(`#${MODULE_NAME}_token_warning`);
    if (!warningEl) return;

    const state = getState();
    const textEl = warningEl.querySelector('.cr-token-warning__text');

    // Only show warning for rewrite stage
    if (state.activeStage !== 'rewrite' || characterTokens === 0) {
        warningEl.classList.add('cr-hidden');
        return;
    }

    // Get max output tokens - override takes precedence
    const settings = getSettings();
    const status = getApiStatus(settings.profileId);
    const maxOutput =
        settings.maxTokensOverride !== null
            ? settings.maxTokensOverride
            : status.maxOutput;

    // Thresholds: warning if under 80% headroom, critical if under character tokens
    const criticalThreshold = characterTokens;
    const warningThreshold = Math.ceil(characterTokens * 1.2); // Need ~20% headroom

    if (maxOutput < criticalThreshold) {
        warningEl.classList.remove('cr-hidden');
        warningEl.classList.add('cr-token-warning--critical');
        warningEl.classList.remove('cr-token-warning--warning');
        if (textEl) {
            textEl.textContent = `Max output (${maxOutput.toLocaleString()}t) is less than character tokens (~${characterTokens.toLocaleString()}t). Rewrite will likely be truncated.`;
        }
    } else if (maxOutput < warningThreshold) {
        warningEl.classList.remove('cr-hidden');
        warningEl.classList.remove('cr-token-warning--critical');
        warningEl.classList.add('cr-token-warning--warning');
        if (textEl) {
            textEl.textContent = `Max output (${maxOutput.toLocaleString()}t) is close to character tokens (~${characterTokens.toLocaleString()}t). Consider increasing output limit.`;
        }
    } else {
        warningEl.classList.add('cr-hidden');
    }
}

// =============================================================================
// PROMPT TOKEN COUNT
// =============================================================================

/**
 * Update token count display for prompt textarea.
 */
export async function updatePromptTokenCount(text: string): Promise<void> {
    const countEl = $(`#${MODULE_NAME}_prompt_tokens`);
    if (!countEl) return;

    // Use centralized token counting with caching
    const count = await getTokenCount(text);
    if (count !== null) {
        countEl.textContent = `~${count} tokens`;
    } else {
        // Fallback to rough estimate if token counting unavailable
        countEl.textContent = `~${Math.ceil(text.length / 4)} tokens`;
    }
}
