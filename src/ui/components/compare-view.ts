// src/ui/components/compare-view.ts
// =============================================================================
// COMPARE VIEW COMPONENT
// Side-by-side diff showing Original vs Rewritten for each field
// =============================================================================

import { MODULE_NAME, popup } from '../../shared';
import { getState } from '../../state';
import { $, on } from './base';
import { getPopulatedFields } from '../../domain/character/fields';

// =============================================================================
// TYPES
// =============================================================================

interface FieldComparison {
    key: string;
    label: string;
    original: string;
    rewritten: string | null;
    hasChanges: boolean;
}

// =============================================================================
// DIFF UTILITIES
// =============================================================================

/**
 * Extract field values from rewrite output.
 * Assumes the rewrite output contains markdown sections with field names.
 */
function parseRewriteOutput(output: string): Record<string, string> {
    const fields: Record<string, string> = {};

    // Match sections like "### Description" or "## Personality"
    const sectionRegex = /^#{2,3}\s*(.+?)[\s:]*$/gm;
    const sections: { name: string; start: number }[] = [];

    let match;
    while ((match = sectionRegex.exec(output)) !== null) {
        sections.push({
            name: match[1].trim().toLowerCase(),
            start: match.index + match[0].length,
        });
    }

    // Extract content between sections
    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const nextStart = sections[i + 1]?.start ?? output.length;
        const content = output.slice(section.start, nextStart).trim();

        // Remove trailing section markers
        const cleanContent = content.replace(/^#{2,3}\s*.+$/gm, '').trim();

        // Map section names to field keys
        const fieldKey = mapSectionToFieldKey(section.name);
        if (fieldKey && cleanContent) {
            fields[fieldKey] = cleanContent;
        }
    }

    return fields;
}

/**
 * Map section name to field key.
 */
function mapSectionToFieldKey(sectionName: string): string | null {
    const normalized = sectionName.toLowerCase().replace(/[^a-z0-9]/g, '');

    const mappings: Record<string, string> = {
        description: 'description',
        personality: 'personality',
        firstmessage: 'first_mes',
        greeting: 'first_mes',
        scenario: 'scenario',
        examplemessages: 'mes_example',
        examples: 'mes_example',
        systemprompt: 'system_prompt',
        system: 'system_prompt',
        posthistoryinstructions: 'post_history_instructions',
        posthistory: 'post_history_instructions',
        creatornotes: 'creator_notes',
        notes: 'creator_notes',
        alternategreetings: 'alternate_greetings',
        greetings: 'alternate_greetings',
    };

    return mappings[normalized] || null;
}

/**
 * Sanitize text for display in the comparison view.
 * Simple side-by-side display without diff highlighting.
 */
function highlightDiff(
    original: string,
    rewritten: string,
): { originalHtml: string; rewrittenHtml: string } {
    const DOMPurify = SillyTavern.libs.DOMPurify;

    return {
        originalHtml: DOMPurify.sanitize(original),
        rewrittenHtml: DOMPurify.sanitize(rewritten),
    };
}

// =============================================================================
// COMPARISON BUILDING
// =============================================================================

/**
 * Build field comparisons from state.
 */
function buildComparisons(): FieldComparison[] {
    const state = getState();
    const comparisons: FieldComparison[] = [];

    if (!state.character) return comparisons;

    const originalFields = getPopulatedFields(state.character);
    const rewriteResult = state.stageResults.rewrite;

    // Parse rewrite output if available
    const rewrittenFields = rewriteResult?.output
        ? parseRewriteOutput(rewriteResult.output)
        : {};

    for (const field of originalFields) {
        const rewritten = rewrittenFields[field.key] || null;

        comparisons.push({
            key: field.key,
            label: field.label,
            original: field.value,
            rewritten,
            hasChanges: rewritten !== null && rewritten !== field.value,
        });
    }

    return comparisons;
}

// =============================================================================
// HTML TEMPLATES
// =============================================================================

function renderComparisonRow(comparison: FieldComparison): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;

    if (!comparison.rewritten) {
        // No rewrite for this field
        return /* html */ `
            <div class="cr-compare-row cr-compare-row--unchanged">
                <div class="cr-compare-row__header">
                    <span class="cr-compare-row__label">${comparison.label}</span>
                    <span class="cr-badge cr-badge--small cr-badge--muted">No changes</span>
                </div>
                <div class="cr-compare-row__content cr-compare-row__content--single">
                    <pre class="cr-compare-text">${DOMPurify.sanitize(comparison.original)}</pre>
                </div>
            </div>
        `;
    }

    const { originalHtml, rewrittenHtml } = highlightDiff(
        comparison.original,
        comparison.rewritten,
    );

    return /* html */ `
        <div class="cr-compare-row ${comparison.hasChanges ? 'cr-compare-row--changed' : ''}">
            <div class="cr-compare-row__header">
                <span class="cr-compare-row__label">${comparison.label}</span>
                ${comparison.hasChanges ? '<span class="cr-badge cr-badge--small cr-badge--accent">Modified</span>' : ''}
            </div>
            <div class="cr-compare-row__content">
                <div class="cr-compare-col cr-compare-col--original">
                    <div class="cr-compare-col__header">
                        <i class="fa-solid fa-file"></i> Original
                    </div>
                    <pre class="cr-compare-text">${originalHtml}</pre>
                </div>
                <div class="cr-compare-col cr-compare-col--rewritten">
                    <div class="cr-compare-col__header">
                        <i class="fa-solid fa-pen-fancy"></i> Rewritten
                    </div>
                    <pre class="cr-compare-text">${rewrittenHtml}</pre>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render compare view.
 */
export function renderCompareView(): string {
    const state = getState();

    if (!state.character) {
        return /* html */ `
            <div class="cr-empty">
                <i class="fa-solid fa-code-compare cr-empty__icon"></i>
                <div class="cr-empty__title">No character selected</div>
                <div class="cr-empty__text">Select a character to compare versions</div>
            </div>
        `;
    }

    if (!state.stageResults.rewrite) {
        return /* html */ `
            <div class="cr-empty">
                <i class="fa-solid fa-code-compare cr-empty__icon"></i>
                <div class="cr-empty__title">No rewrite available</div>
                <div class="cr-empty__text">Run the Rewrite stage first to see comparisons</div>
            </div>
        `;
    }

    const comparisons = buildComparisons();
    const changedCount = comparisons.filter((c) => c.hasChanges).length;

    return /* html */ `
        <div class="cr-compare-view">
            <div class="cr-compare-header">
                <div class="cr-compare-stats">
                    <span class="cr-badge cr-badge--accent">${changedCount} field${changedCount !== 1 ? 's' : ''} modified</span>
                    <span class="cr-badge cr-badge--muted">${comparisons.length - changedCount} unchanged</span>
                </div>
            </div>
            <div class="cr-compare-list cr-scrollable">
                ${comparisons.map(renderComparisonRow).join('')}
            </div>
        </div>
    `;
}

/**
 * Update compare view.
 */
export function updateCompareView(): void {
    const container = $(`#${MODULE_NAME}_compare_content`);
    if (!container) return;

    container.innerHTML = renderCompareView();
}

/**
 * Bind compare view events.
 */
export function bindCompareViewEvents(container: HTMLElement): () => void {
    const cleanups: Array<() => void> = [];

    // Click on a row to expand in popup
    const compareList = $('.cr-compare-list', container);
    if (compareList) {
        cleanups.push(
            on(compareList, 'click', (e) => {
                const row = (e.target as HTMLElement).closest(
                    '.cr-compare-row',
                );
                if (!row) return;

                // Get the label from the row
                const labelEl = row.querySelector('.cr-compare-row__label');
                const label = labelEl?.textContent || 'Field';

                // Get content
                const originalPre = row.querySelector(
                    '.cr-compare-col--original pre',
                );
                const rewrittenPre = row.querySelector(
                    '.cr-compare-col--rewritten pre',
                );

                if (originalPre && rewrittenPre) {
                    popup.alert(
                        `Compare: ${label}`,
                        /* html */ `
                        <div class="cr-compare-popup">
                            <div class="cr-compare-popup__side">
                                <h4>Original</h4>
                                <pre>${originalPre.innerHTML}</pre>
                            </div>
                            <div class="cr-compare-popup__side">
                                <h4>Rewritten</h4>
                                <pre>${rewrittenPre.innerHTML}</pre>
                            </div>
                        </div>
                        `,
                    );
                }
            }),
        );
    }

    return () => {
        cleanups.forEach((fn) => fn());
    };
}
