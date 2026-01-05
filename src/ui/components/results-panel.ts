// src/ui/components/results-panel.ts
// =============================================================================
// RESULTS PANEL COMPONENT
// =============================================================================

import { MODULE_NAME, STAGE_LABELS, STAGE_ICONS, popup } from '../../shared';
import { getState, toggleHistory } from '../../state';
import { getSchemaPreset } from '../../data/settings';
import { $, on, cx, truncate, morphUpdate } from './base';
import { renderCompareView, bindCompareViewEvents } from './compare-view';
import { showApplyDialog, buildFieldUpdates } from './apply-suggestions';
import {
    formatResponse,
    formatStructuredResponse,
    parseStructuredResponse,
} from '../formatter';
import type { StageName, StageResult } from '../../types';

// Track current view mode
let currentViewMode: 'result' | 'compare' = 'result';
// Track JSON display mode (raw vs smart)
let jsonDisplayMode: 'smart' | 'raw' = 'smart';
// Track text display mode (formatted vs raw)
let textDisplayMode: 'formatted' | 'raw' = 'formatted';

// =============================================================================
// CLIPBOARD UTILITIES
// =============================================================================

/**
 * Copy text to clipboard with fallback for insecure contexts
 */
async function copyToClipboard(text: string): Promise<boolean> {
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Fall through to fallback
        }
    }

    // Fallback for insecure contexts (e.g., HTTP, iframes)
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
    } catch {
        return false;
    }
}

// =============================================================================
// HTML TEMPLATES
// =============================================================================

function renderResultContent(
    result: StageResult | null,
    stage: StageName,
): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const hljs = SillyTavern.libs.hljs;

    if (!result) {
        return `
            <div class="ct-empty">
                <i class="fa-solid ${STAGE_ICONS[stage]} ct-empty__icon"></i>
                <div class="ct-empty__title">No results yet</div>
                <div class="ct-empty__text">Run ${STAGE_LABELS[stage]} to see results</div>
            </div>
        `;
    }

    if (result.error) {
        return `
            <div class="ct-alert ct-alert--danger">
                <i class="fa-solid fa-exclamation-triangle ct-alert__icon"></i>
                <div class="ct-alert__content">
                    <div class="ct-alert__title">Error</div>
                    <div class="ct-alert__message">${DOMPurify.sanitize(result.error)}</div>
                </div>
            </div>
        `;
    }

    // Check if content is JSON
    const parsedJson = parseStructuredResponse(result.output);
    const isJson = parsedJson !== null && typeof parsedJson === 'object';

    // JSON output - show smart view with toggle to raw
    if (isJson) {
        const formattedJson = JSON.stringify(parsedJson, null, 2);

        // Get schema from state if available (for schema-aware rendering)
        const state = getState();
        const stageConfig = state.stageConfigs[stage];
        let schema = null;
        if (stageConfig?.schemaPresetId) {
            const preset = getSchemaPreset(stageConfig.schemaPresetId);
            schema = preset?.schema ?? null;
        }

        // Render based on display mode
        let contentHtml: string;
        if (jsonDisplayMode === 'smart') {
            contentHtml = formatStructuredResponse(result.output, schema);
        } else {
            // Raw JSON with syntax highlighting
            let highlightedHtml: string;
            try {
                highlightedHtml = hljs.highlight(formattedJson, {
                    language: 'json',
                }).value;
            } catch {
                highlightedHtml = DOMPurify.sanitize(formattedJson);
            }
            contentHtml = `<pre class="ct-result__code hljs"><code>${highlightedHtml}</code></pre>`;
        }

        return `
            <div class="ct-result">
                <div class="ct-result__header">
                    <span class="ct-result__type">
                        <i class="fa-solid fa-brackets-curly"></i>
                        Structured Output
                    </span>
                    <div class="ct-result__actions">
                        <div class="ct-json-toggle">
                            <button class="ct-json-toggle__btn ${jsonDisplayMode === 'smart' ? 'ct-json-toggle__btn--active' : ''}"
                                    data-mode="smart"
                                    type="button"
                                    title="Smart formatted view">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>
                            </button>
                            <button class="ct-json-toggle__btn ${jsonDisplayMode === 'raw' ? 'ct-json-toggle__btn--active' : ''}"
                                    data-mode="raw"
                                    type="button"
                                    title="Raw JSON view">
                                <i class="fa-solid fa-code"></i>
                            </button>
                        </div>
                        <button class="ct-result-copy menu_button menu_button--icon menu_button--sm menu_button--ghost"
                                data-content="${encodeURIComponent(formattedJson)}"
                                type="button"
                                title="Copy to clipboard">
                            <i class="fa-solid fa-copy"></i>
                        </button>
                    </div>
                </div>
                <div class="ct-result__content">
                    ${contentHtml}
                </div>
            </div>
        `;
    }

    // Text/Markdown output - use hybrid formatter with raw toggle
    let contentHtml: string;
    if (textDisplayMode === 'formatted') {
        contentHtml = formatResponse(result.output);
    } else {
        // Raw text output - preserve whitespace and escape HTML
        contentHtml = `<pre class="ct-result__raw">${DOMPurify.sanitize(result.output)}</pre>`;
    }

    return `
        <div class="ct-result">
            <div class="ct-result__header">
                <span class="ct-result__type">
                    <i class="fa-solid fa-file-lines"></i>
                    Analysis
                </span>
                <div class="ct-result__actions">
                    <div class="ct-text-toggle">
                        <button class="ct-text-toggle__btn ${textDisplayMode === 'formatted' ? 'ct-text-toggle__btn--active' : ''}"
                                data-mode="formatted"
                                type="button"
                                title="Formatted view">
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                        </button>
                        <button class="ct-text-toggle__btn ${textDisplayMode === 'raw' ? 'ct-text-toggle__btn--active' : ''}"
                                data-mode="raw"
                                type="button"
                                title="Raw text (easy to copy)">
                            <i class="fa-solid fa-code"></i>
                        </button>
                    </div>
                    <button class="ct-result-copy menu_button menu_button--icon menu_button--sm menu_button--ghost"
                            data-content="${encodeURIComponent(result.output)}"
                            type="button"
                            title="Copy to clipboard">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </div>
            </div>
            <div class="ct-result__content">
                ${contentHtml}
            </div>
        </div>
    `;
}

function renderHistoryItem(result: StageResult, index: number): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const moment = SillyTavern.libs.moment;

    // Use moment for smarter date formatting
    const m = moment(result.timestamp);
    const timeStr = m.fromNow(); // "5 minutes ago", "2 hours ago", etc.
    const fullTime = m.format('MMM D, h:mm A'); // For tooltip

    const preview = truncate(result.output || result.error || '', 100);

    return `
        <div class="ct-list-item ${cx(result.error && 'ct-list-item--error')}"
             data-index="${index}">
            <div class="ct-list-item__content">
                <div class="ct-row ct-row--between">
                    <span class="ct-list-item__title">
                        <i class="fa-solid ${STAGE_ICONS[result.stage]} ct-text-accent"></i>
                        ${STAGE_LABELS[result.stage]}
                    </span>
                    <span class="ct-text-xs ct-text-dim" title="${fullTime}">${timeStr}</span>
                </div>
                <div class="ct-list-item__subtitle ct-truncate">${DOMPurify.sanitize(preview)}</div>
            </div>
        </div>
    `;
}

/**
 * Render results panel.
 */
export function renderResultsPanel(): string {
    const state = getState();
    const activeResult = state.stageResults[state.activeStage];
    const hasRewrite = !!state.stageResults.rewrite;
    const hasHistory = state.iterationHistory.length > 0;

    // Check if there are updates available
    const hasUpdates = hasRewrite && buildFieldUpdates().length > 0;

    // View toggle (only show if rewrite exists)
    const viewToggle = hasRewrite
        ? `
            <div class="ct-view-toggle">
                <button class="ct-view-toggle__btn ${currentViewMode === 'result' ? 'ct-view-toggle__btn--active' : ''}"
                        data-view="result"
                        type="button"
                        title="Show stage result">
                    <i class="fa-solid fa-file-lines"></i> Result
                </button>
                <button class="ct-view-toggle__btn ${currentViewMode === 'compare' ? 'ct-view-toggle__btn--active' : ''}"
                        data-view="compare"
                        type="button"
                        title="Compare original vs rewritten">
                    <i class="fa-solid fa-code-compare"></i> Compare
                </button>
            </div>
            ${
                hasUpdates
                    ? `
                <button class="menu_button menu_button--primary menu_button--sm ct-apply-btn"
                        type="button"
                        title="Apply rewritten content to character card">
                    <i class="fa-solid fa-check"></i> Apply
                </button>
            `
                    : ''
            }
        `
        : '';

    // Content based on view mode
    const content =
        currentViewMode === 'compare' && hasRewrite
            ? `<div id="${MODULE_NAME}_compare_content">${renderCompareView()}</div>`
            : renderResultContent(activeResult, state.activeStage);

    // Only show history section if there's actual history
    const historySection = hasHistory
        ? `
            <div class="ct-history ${cx(!state.historyExpanded && 'ct-history--collapsed')}">
                <button class="ct-history__toggle"
                        type="button"
                        aria-expanded="${state.historyExpanded}"
                        title="Previous pipeline runs in this session">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                    <span>Run History (${state.iterationHistory.length})</span>
                    <i class="fa-solid fa-chevron-down ct-history__toggle-icon"></i>
                </button>
                <div id="${MODULE_NAME}_history_list" class="ct-history__list ct-list">
                    ${state.iterationHistory
                        .map((r, i) => renderHistoryItem(r, i))
                        .join('')}
                </div>
            </div>
        `
        : '';

    return `
        <div class="ct-results-wrapper">
            <!-- View Toggle -->
            ${viewToggle ? `<div class="ct-results-toolbar">${viewToggle}</div>` : ''}

            <!-- Results/Compare content -->
            <div id="${MODULE_NAME}_results_content" class="ct-results-content">
                ${content}
            </div>

            <!-- Run History Section (only if there's history) -->
            ${historySection}
        </div>
    `;
}

/**
 * Update results display.
 */
export function updateResults(): void {
    const state = getState();
    const hasRewrite = !!state.stageResults.rewrite;
    const hasUpdates = hasRewrite && buildFieldUpdates().length > 0;
    const hasHistory = state.iterationHistory.length > 0;

    const resultsWrapper = $('.ct-results-wrapper');
    if (!resultsWrapper) return;

    // Update or create the view toggle toolbar
    let toolbar = resultsWrapper.querySelector(
        '.ct-results-toolbar',
    ) as HTMLElement | null;

    if (hasRewrite) {
        const viewToggleHtml = `
            <div class="ct-view-toggle">
                <button class="ct-view-toggle__btn ${currentViewMode === 'result' ? 'ct-view-toggle__btn--active' : ''}"
                        data-view="result"
                        type="button"
                        title="Show stage result">
                    <i class="fa-solid fa-file-lines"></i> Result
                </button>
                <button class="ct-view-toggle__btn ${currentViewMode === 'compare' ? 'ct-view-toggle__btn--active' : ''}"
                        data-view="compare"
                        type="button"
                        title="Compare original vs rewritten">
                    <i class="fa-solid fa-code-compare"></i> Compare
                </button>
            </div>
            ${
                hasUpdates
                    ? `
                <button class="menu_button menu_button--primary menu_button--sm ct-apply-btn"
                        type="button"
                        title="Apply rewritten content to character card">
                    <i class="fa-solid fa-check"></i> Apply
                </button>
            `
                    : ''
            }
        `;

        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.className = 'ct-results-toolbar';
            const resultsContent = $(`#${MODULE_NAME}_results_content`);
            if (resultsContent) {
                resultsWrapper.insertBefore(toolbar, resultsContent);
            }
        }
        toolbar.innerHTML = viewToggleHtml;
    } else if (toolbar) {
        toolbar.remove();
    }

    // Update content based on view mode
    const container = $(`#${MODULE_NAME}_results_content`);
    if (!container) return;

    if (currentViewMode === 'compare' && hasRewrite) {
        container.innerHTML = `<div id="${MODULE_NAME}_compare_content">${renderCompareView()}</div>`;
    } else {
        const activeResult = state.stageResults[state.activeStage];
        container.innerHTML = renderResultContent(
            activeResult,
            state.activeStage,
        );
    }

    // Update or create history section
    let historySection = resultsWrapper.querySelector(
        '.ct-history',
    ) as HTMLElement | null;

    if (hasHistory) {
        if (!historySection) {
            historySection = document.createElement('div');
            historySection.className = `ct-history ${!state.historyExpanded ? 'ct-history--collapsed' : ''}`;
            historySection.innerHTML = `
                <button class="ct-history__toggle"
                        type="button"
                        aria-expanded="${state.historyExpanded}"
                        title="Previous pipeline runs in this session">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                    <span>Run History (${state.iterationHistory.length})</span>
                    <i class="fa-solid fa-chevron-down ct-history__toggle-icon"></i>
                </button>
                <div id="${MODULE_NAME}_history_list" class="ct-history__list ct-list">
                </div>
            `;
            resultsWrapper.appendChild(historySection);
        }

        // Update history list
        const historyList = $(`#${MODULE_NAME}_history_list`);
        if (historyList) {
            const historyHtml = state.iterationHistory
                .map((r, i) => renderHistoryItem(r, i))
                .join('');
            morphUpdate(historyList, historyHtml);
        }

        // Update toggle text
        const toggleSpan = historySection.querySelector(
            '.ct-history__toggle span',
        );
        if (toggleSpan) {
            toggleSpan.textContent = `Run History (${state.iterationHistory.length})`;
        }
    } else if (historySection) {
        historySection.remove();
    }
}

/**
 * Bind results panel events.
 */
export function bindResultsPanelEvents(container: HTMLElement): () => void {
    const cleanups: Array<() => void> = [];

    // View toggle buttons (result/compare)
    cleanups.push(
        on(container, 'click', (e) => {
            const btn = (e.target as HTMLElement).closest(
                '.ct-view-toggle__btn',
            );
            if (!btn) return;

            const view = (btn as HTMLElement).dataset.view as
                | 'result'
                | 'compare';
            if (view && view !== currentViewMode) {
                currentViewMode = view;
                updateResults();

                // Bind compare view events if switching to compare
                if (view === 'compare') {
                    const compareContent = $(`#${MODULE_NAME}_compare_content`);
                    if (compareContent) {
                        cleanups.push(bindCompareViewEvents(compareContent));
                    }
                }
            }
        }),
    );

    // JSON display mode toggle (smart/raw)
    cleanups.push(
        on(container, 'click', (e) => {
            const btn = (e.target as HTMLElement).closest(
                '.ct-json-toggle__btn',
            );
            if (!btn) return;

            const mode = (btn as HTMLElement).dataset.mode as 'smart' | 'raw';
            if (mode && mode !== jsonDisplayMode) {
                jsonDisplayMode = mode;
                updateResults();
            }
        }),
    );

    // Text display mode toggle (formatted/raw)
    cleanups.push(
        on(container, 'click', (e) => {
            const btn = (e.target as HTMLElement).closest(
                '.ct-text-toggle__btn',
            );
            if (!btn) return;

            const mode = (btn as HTMLElement).dataset.mode as
                | 'formatted'
                | 'raw';
            if (mode && mode !== textDisplayMode) {
                textDisplayMode = mode;
                updateResults();
            }
        }),
    );

    // Apply button
    cleanups.push(
        on(container, 'click', (e) => {
            const applyBtn = (e.target as HTMLElement).closest('.ct-apply-btn');
            if (!applyBtn) return;

            showApplyDialog();
        }),
    );

    // Copy buttons (event delegation)
    const resultsContent = $(`#${MODULE_NAME}_results_content`, container);
    if (resultsContent) {
        cleanups.push(
            on(resultsContent, 'click', async (e) => {
                const copyBtn = (e.target as HTMLElement).closest(
                    '.ct-result-copy',
                );
                if (!copyBtn) return;

                const content = decodeURIComponent(
                    (copyBtn as HTMLElement).dataset.content || '',
                );

                const success = await copyToClipboard(content);
                const icon = copyBtn.querySelector('i');

                if (success) {
                    // Success feedback
                    if (icon) {
                        icon.className = 'fa-solid fa-check';
                        setTimeout(() => {
                            icon.className = 'fa-solid fa-copy';
                        }, 1500);
                    }
                } else {
                    // Failure feedback
                    if (icon) {
                        icon.className = 'fa-solid fa-xmark';
                        setTimeout(() => {
                            icon.className = 'fa-solid fa-copy';
                        }, 1500);
                    }
                    console.error('Failed to copy to clipboard');
                }
            }),
        );
    }

    // History toggle
    const historyToggle = $('.ct-history__toggle', container);
    const historySection = $('.ct-history', container);
    if (historyToggle && historySection) {
        cleanups.push(
            on(historyToggle, 'click', () => {
                toggleHistory();
                historySection.classList.toggle('ct-history--collapsed');
                historyToggle.setAttribute(
                    'aria-expanded',
                    String(getState().historyExpanded),
                );
            }),
        );
    }

    // History item click (show full result in popup)
    const historyList = $(`#${MODULE_NAME}_history_list`, container);
    if (historyList) {
        cleanups.push(
            on(historyList, 'click', async (e) => {
                const DOMPurify = SillyTavern.libs.DOMPurify;
                const item = (e.target as HTMLElement).closest('.ct-list-item');
                if (!item) return;

                const index = parseInt(
                    (item as HTMLElement).dataset.index || '0',
                    10,
                );
                const state = getState();
                const result = state.iterationHistory[index];

                if (!result) return;

                const date = new Date(result.timestamp);
                const content = result.error
                    ? `<div class="ct-error-box">${DOMPurify.sanitize(result.error)}</div>`
                    : `<div class="ct-preview-content">${formatResponse(result.output)}</div>`;

                popup.alert(
                    `${STAGE_LABELS[result.stage]} - ${date.toLocaleString()}`,
                    content,
                );
            }),
        );
    }

    return () => {
        cleanups.forEach((fn) => fn());
    };
}
