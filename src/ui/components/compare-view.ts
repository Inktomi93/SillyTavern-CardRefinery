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
 * Word-level diff highlighting using DiffMatchPatch.
 * Returns HTML with deletions/additions highlighted in both panels.
 *
 * Uses the diff-match-patch library for character-accurate diffs,
 * then cleans up the output to word boundaries for readability.
 */
function highlightDiff(
    original: string,
    rewritten: string,
): { originalHtml: string; rewrittenHtml: string } {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const DiffMatchPatch = SillyTavern.libs.DiffMatchPatch;

    // Create diff instance
    const dmp = new DiffMatchPatch();

    // Compute character-level diff
    const diffs = dmp.diff_main(original, rewritten);

    // Cleanup for better readability (merge small edits, word boundaries)
    dmp.diff_cleanupSemantic(diffs);

    // Build highlighted HTML for both sides
    // diffs is array of [operation, text] where:
    //   -1 = DIFF_DELETE (only in original)
    //    0 = DIFF_EQUAL (in both)
    //    1 = DIFF_INSERT (only in rewritten)

    const originalParts: string[] = [];
    const rewrittenParts: string[] = [];

    for (const [op, text] of diffs) {
        const sanitized = DOMPurify.sanitize(text);

        switch (op) {
            case -1: // DELETE - show in original only, marked as removed
                originalParts.push(
                    `<span class="ct-diff--removed">${sanitized}</span>`,
                );
                break;
            case 1: // INSERT - show in rewritten only, marked as added
                rewrittenParts.push(
                    `<span class="ct-diff--added">${sanitized}</span>`,
                );
                break;
            case 0: // EQUAL - show in both, no highlighting
            default:
                originalParts.push(sanitized);
                rewrittenParts.push(sanitized);
                break;
        }
    }

    return {
        originalHtml: originalParts.join(''),
        rewrittenHtml: rewrittenParts.join(''),
    };
}

/**
 * Compute diff statistics for a comparison.
 */
export function getDiffStats(
    original: string,
    rewritten: string,
): { additions: number; deletions: number; unchanged: number } {
    const DiffMatchPatch = SillyTavern.libs.DiffMatchPatch;
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(original, rewritten);

    let additions = 0;
    let deletions = 0;
    let unchanged = 0;

    for (const [op, text] of diffs) {
        const len = text.length;
        switch (op) {
            case -1:
                deletions += len;
                break;
            case 1:
                additions += len;
                break;
            default:
                unchanged += len;
        }
    }

    return { additions, deletions, unchanged };
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
        return `
            <div class="ct-compare-row ct-compare-row--unchanged">
                <div class="ct-compare-row__header">
                    <span class="ct-compare-row__label">${comparison.label}</span>
                    <span class="ct-badge ct-badge--small ct-badge--muted">No changes</span>
                </div>
                <div class="ct-compare-row__content ct-compare-row__content--single">
                    <pre class="ct-compare-text">${DOMPurify.sanitize(comparison.original)}</pre>
                </div>
            </div>
        `;
    }

    const { originalHtml, rewrittenHtml } = highlightDiff(
        comparison.original,
        comparison.rewritten,
    );

    // Get diff statistics for display
    const stats = getDiffStats(comparison.original, comparison.rewritten);
    const hasStats = stats.additions > 0 || stats.deletions > 0;

    return `
        <div class="ct-compare-row ${comparison.hasChanges ? 'ct-compare-row--changed' : ''}">
            <div class="ct-compare-row__header">
                <span class="ct-compare-row__label">${comparison.label}</span>
                <div class="ct-compare-row__badges">
                    ${comparison.hasChanges ? '<span class="ct-badge ct-badge--small ct-badge--accent">Modified</span>' : ''}
                    ${hasStats ? `<span class="ct-diff-stats"><span class="ct-diff-stats__add">+${stats.additions}</span> <span class="ct-diff-stats__del">-${stats.deletions}</span></span>` : ''}
                </div>
            </div>
            <div class="ct-compare-row__content">
                <div class="ct-compare-col ct-compare-col--original">
                    <div class="ct-compare-col__header">
                        <i class="fa-solid fa-file"></i> Original
                    </div>
                    <pre class="ct-compare-text">${originalHtml}</pre>
                </div>
                <div class="ct-compare-col ct-compare-col--rewritten">
                    <div class="ct-compare-col__header">
                        <i class="fa-solid fa-pen-fancy"></i> Rewritten
                    </div>
                    <pre class="ct-compare-text">${rewrittenHtml}</pre>
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
        return `
            <div class="ct-empty">
                <i class="fa-solid fa-code-compare ct-empty__icon"></i>
                <div class="ct-empty__title">No character selected</div>
                <div class="ct-empty__text">Select a character to compare versions</div>
            </div>
        `;
    }

    if (!state.stageResults.rewrite) {
        return `
            <div class="ct-empty">
                <i class="fa-solid fa-code-compare ct-empty__icon"></i>
                <div class="ct-empty__title">No rewrite available</div>
                <div class="ct-empty__text">Run the Rewrite stage first to see comparisons</div>
            </div>
        `;
    }

    const comparisons = buildComparisons();
    const changedCount = comparisons.filter((c) => c.hasChanges).length;

    return `
        <div class="ct-compare-view">
            <div class="ct-compare-header">
                <div class="ct-compare-stats">
                    <span class="ct-badge ct-badge--accent">${changedCount} field${changedCount !== 1 ? 's' : ''} modified</span>
                    <span class="ct-badge ct-badge--muted">${comparisons.length - changedCount} unchanged</span>
                </div>
            </div>
            <div class="ct-compare-list ct-scrollable">
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
    const compareList = $('.ct-compare-list', container);
    if (compareList) {
        cleanups.push(
            on(compareList, 'click', (e) => {
                const row = (e.target as HTMLElement).closest(
                    '.ct-compare-row',
                );
                if (!row) return;

                // Get the label from the row
                const labelEl = row.querySelector('.ct-compare-row__label');
                const label = labelEl?.textContent || 'Field';

                // Get content
                const originalPre = row.querySelector(
                    '.ct-compare-col--original pre',
                );
                const rewrittenPre = row.querySelector(
                    '.ct-compare-col--rewritten pre',
                );

                if (originalPre && rewrittenPre) {
                    popup.alert(
                        `Compare: ${label}`,
                        `
                        <div class="ct-compare-popup">
                            <div class="ct-compare-popup__side">
                                <h4>Original</h4>
                                <pre>${originalPre.innerHTML}</pre>
                            </div>
                            <div class="ct-compare-popup__side">
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
