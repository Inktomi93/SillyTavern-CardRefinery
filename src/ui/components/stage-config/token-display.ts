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
import type { PopulatedField } from '../../../types';

// =============================================================================
// FIELD TOKEN LOADING
// =============================================================================

/**
 * Load token counts for fields and update the display.
 */
export async function loadFieldTokens(fields: PopulatedField[]): Promise<void> {
    const items = fields
        .filter((f) => f.key !== 'alternate_greetings') // Skip grouped fields
        .map((f) => ({ key: f.key, text: f.value }));

    if (items.length === 0) return;

    const results = await getTokenCountsKeyed(items);

    // Update each token display element and store counts
    for (const { key, tokens } of results) {
        if (tokens !== null) {
            fieldTokenCounts.set(key, tokens);
        }
        const el = $(`.cr-field-tokens[data-field="${key}"]`);
        if (el) {
            el.textContent = formatTokenCount(tokens);
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

    for (const [key, tokens] of fieldTokenCounts) {
        const isSelected = key in selection && selection[key] !== false;
        if (isSelected) {
            total += tokens;
            selectedCount++;
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
