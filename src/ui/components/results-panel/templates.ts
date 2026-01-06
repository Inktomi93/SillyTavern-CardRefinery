// src/ui/components/results-panel/templates.ts
// =============================================================================
// HTML TEMPLATES
// =============================================================================

import { MODULE_NAME, STAGE_LABELS, STAGE_ICONS } from '../../../shared';
import { getState, getViewedHistoryItem } from '../../../state';
import { getSchemaPreset } from '../../../data/settings';
import { cx, truncate } from '../base';
import { withRenderBoundary } from '../../error-boundary';
import { renderCompareView } from '../compare-view';
import {
    formatResponse,
    formatStructuredResponse,
    parseStructuredResponse,
} from '../../formatter';
import type { StageName, StageResult } from '../../../types';
import { getViewMode, getJsonDisplayMode, getTextDisplayMode } from './state';

// =============================================================================
// TEMPLATE FUNCTIONS
// =============================================================================

/**
 * Render the content for a single result.
 */
const _renderResultContent = (
    result: StageResult | null,
    stage: StageName,
): string => {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const hljs = SillyTavern.libs.hljs;

    if (!result) {
        return /* html */ `
            <div class="cr-empty">
                <i class="fa-solid ${STAGE_ICONS[stage]} cr-empty__icon"></i>
                <div class="cr-empty__title">No results yet</div>
                <div class="cr-empty__text">Run ${STAGE_LABELS[stage]} to see results</div>
            </div>
        `;
    }

    if (result.error) {
        return /* html */ `
            <div class="cr-alert cr-alert--danger">
                <i class="fa-solid fa-exclamation-triangle cr-alert__icon"></i>
                <div class="cr-alert__content">
                    <div class="cr-alert__title">Error</div>
                    <div class="cr-alert__message">${DOMPurify.sanitize(result.error)}</div>
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

        // Render based on display mode (per-stage)
        const jsonMode = getJsonDisplayMode(stage);
        let contentHtml: string;
        if (jsonMode === 'smart') {
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
            contentHtml = /* html */ `<pre class="cr-result__code hljs"><code>${highlightedHtml}</code></pre>`;
        }

        return /* html */ `
            <div class="cr-result" data-stage="${stage}">
                <div class="cr-result__header">
                    <span class="cr-result__type">
                        <i class="fa-solid fa-brackets-curly"></i>
                        Structured Output
                    </span>
                    <div class="cr-result__actions">
                        <div class="cr-json-toggle" data-stage="${stage}">
                            <button class="cr-json-toggle__btn ${jsonMode === 'smart' ? 'cr-json-toggle__btn--active' : ''}"
                                    data-mode="smart"
                                    type="button"
                                    title="Smart formatted view">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>
                            </button>
                            <button class="cr-json-toggle__btn ${jsonMode === 'raw' ? 'cr-json-toggle__btn--active' : ''}"
                                    data-mode="raw"
                                    type="button"
                                    title="Raw JSON view">
                                <i class="fa-solid fa-code"></i>
                            </button>
                        </div>
                        <button class="cr-result-copy menu_button menu_button--icon menu_button--sm menu_button--ghost"
                                data-type="json"
                                data-stage="${stage}"
                                data-raw="${encodeURIComponent(result.output)}"
                                data-formatted="${encodeURIComponent(formattedJson)}"
                                type="button"
                                title="Copy to clipboard">
                            <i class="fa-solid fa-copy"></i>
                        </button>
                    </div>
                </div>
                <div class="cr-result__content">
                    ${contentHtml}
                </div>
            </div>
        `;
    }

    // Text/Markdown output - use hybrid formatter with raw toggle (per-stage)
    const textMode = getTextDisplayMode(stage);
    let contentHtml: string;
    if (textMode === 'formatted') {
        contentHtml = formatResponse(result.output);
    } else {
        // Raw text output - preserve whitespace and escape HTML
        contentHtml = /* html */ `<pre class="cr-result__raw">${DOMPurify.sanitize(result.output)}</pre>`;
    }

    return /* html */ `
        <div class="cr-result" data-stage="${stage}">
            <div class="cr-result__header">
                <span class="cr-result__type">
                    <i class="fa-solid ${STAGE_ICONS[stage]}"></i>
                    ${STAGE_LABELS[stage]}
                </span>
                <div class="cr-result__actions">
                    <div class="cr-text-toggle" data-stage="${stage}">
                        <button class="cr-text-toggle__btn ${textMode === 'formatted' ? 'cr-text-toggle__btn--active' : ''}"
                                data-mode="formatted"
                                type="button"
                                title="Formatted view">
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                        </button>
                        <button class="cr-text-toggle__btn ${textMode === 'raw' ? 'cr-text-toggle__btn--active' : ''}"
                                data-mode="raw"
                                type="button"
                                title="Raw text (easy to copy)">
                            <i class="fa-solid fa-code"></i>
                        </button>
                    </div>
                    <button class="cr-result-copy menu_button menu_button--icon menu_button--sm menu_button--ghost"
                            data-type="text"
                            data-stage="${stage}"
                            data-raw="${encodeURIComponent(result.output)}"
                            type="button"
                            title="Copy to clipboard">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </div>
            </div>
            <div class="cr-result__content">
                ${contentHtml}
            </div>
        </div>
    `;
};
export const renderResultContent = withRenderBoundary(_renderResultContent, {
    name: 'ResultContent',
});

/**
 * Render a single history item.
 */
const _renderHistoryItem = (result: StageResult, index: number): string => {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const moment = SillyTavern.libs.moment;
    const state = getState();

    // Use moment for smarter date formatting
    const m = moment(result.timestamp);
    const timeStr = m.fromNow(); // "5 minutes ago", "2 hours ago", etc.
    const fullTime = m.format('MMM D, h:mm A'); // For tooltip

    const preview = truncate(result.output || result.error || '', 100);
    const isViewing = state.viewingHistoryIndex === index;
    const isCurrentResult =
        state.stageResults[result.stage]?.timestamp === result.timestamp;

    return /* html */ `
        <div class="cr-list-item ${cx(
            result.error && 'cr-list-item--error',
            isViewing && 'cr-list-item--viewing',
            isCurrentResult && 'cr-list-item--current',
        )}"
             data-index="${index}">
            <div class="cr-list-item__content">
                <div class="cr-row cr-row--between">
                    <span class="cr-list-item__title">
                        <i class="fa-solid ${STAGE_ICONS[result.stage]} cr-text-accent"></i>
                        ${STAGE_LABELS[result.stage]}
                        ${isCurrentResult ? '<span class="cr-badge cr-badge--sm">current</span>' : ''}
                    </span>
                    <span class="cr-text-xs cr-text-dim" title="${fullTime}">${timeStr}</span>
                </div>
                <div class="cr-list-item__subtitle cr-truncate">${DOMPurify.sanitize(preview)}</div>
            </div>
            <div class="cr-list-item__actions">
                <button class="cr-history-restore menu_button menu_button--icon menu_button--sm menu_button--ghost"
                        data-index="${index}"
                        type="button"
                        title="Restore this result as current">
                    <i class="fa-solid fa-rotate-left"></i>
                </button>
            </div>
        </div>
    `;
};
export const renderHistoryItem = withRenderBoundary(_renderHistoryItem, {
    name: 'HistoryItem',
});

/**
 * Render the complete results panel.
 */
const _renderResultsPanel = (): string => {
    const state = getState();
    const viewedHistoryItem = getViewedHistoryItem();
    const isViewingHistory = viewedHistoryItem !== null;
    const currentViewMode = getViewMode();

    // When viewing history, show that result; otherwise show current stage result
    const displayResult = isViewingHistory
        ? viewedHistoryItem
        : state.stageResults[state.activeStage];

    const hasRewrite = !!state.stageResults.rewrite;
    const hasHistory = state.iterationHistory.length > 0;

    // Only show compare toggle on rewrite tab and when not viewing history
    const showCompareToggle =
        hasRewrite && !isViewingHistory && state.activeStage === 'rewrite';

    // Show Apply button when viewing rewrite results (not in history view)
    const hasUpdates =
        !isViewingHistory && hasRewrite && state.activeStage === 'rewrite';

    // History navigation bar (shown when viewing history)
    const historyNavBar = isViewingHistory
        ? /* html */ `
            <div class="cr-history-nav">
                <div class="cr-history-nav__info">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                    <span>Viewing history ${(state.viewingHistoryIndex ?? 0) + 1} of ${state.iterationHistory.length}</span>
                </div>
                <div class="cr-history-nav__controls">
                    <button class="cr-history-nav__btn menu_button menu_button--icon menu_button--sm"
                            id="${MODULE_NAME}_history_prev"
                            type="button"
                            title="Previous"
                            ${state.viewingHistoryIndex === 0 ? 'disabled' : ''}>
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <button class="cr-history-nav__btn menu_button menu_button--icon menu_button--sm"
                            id="${MODULE_NAME}_history_next"
                            type="button"
                            title="Next"
                            ${state.viewingHistoryIndex === state.iterationHistory.length - 1 ? 'disabled' : ''}>
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                    <button class="cr-history-nav__btn menu_button menu_button--primary menu_button--sm"
                            id="${MODULE_NAME}_history_restore"
                            type="button"
                            title="Restore this as current result">
                        <i class="fa-solid fa-rotate-left"></i> Restore
                    </button>
                    <button class="cr-history-nav__btn menu_button menu_button--sm"
                            id="${MODULE_NAME}_history_back"
                            type="button"
                            title="Back to current results">
                        <i class="fa-solid fa-xmark"></i> Back
                    </button>
                </div>
            </div>
        `
        : '';

    // View toggle (only show on rewrite tab and not viewing history)
    const viewToggle = showCompareToggle
        ? /* html */ `
            <div class="cr-view-toggle">
                <button class="cr-view-toggle__btn ${currentViewMode === 'result' ? 'cr-view-toggle__btn--active' : ''}"
                        data-view="result"
                        type="button"
                        title="Show stage result">
                    <i class="fa-solid fa-file-lines"></i> Result
                </button>
                <button class="cr-view-toggle__btn ${currentViewMode === 'compare' ? 'cr-view-toggle__btn--active' : ''}"
                        data-view="compare"
                        type="button"
                        title="Compare original vs rewritten">
                    <i class="fa-solid fa-code-compare"></i> Compare
                </button>
            </div>
            ${
                hasUpdates
                    ? /* html */ `
                <button class="menu_button menu_button--primary menu_button--sm cr-apply-btn"
                        type="button"
                        title="Apply or export rewritten content">
                    <i class="fa-solid fa-file-export"></i> Apply / Export
                </button>
            `
                    : ''
            }
        `
        : '';

    // Content based on view mode
    const content = isViewingHistory
        ? renderResultContent(
              displayResult,
              displayResult?.stage ?? state.activeStage,
          )
        : currentViewMode === 'compare' && showCompareToggle
          ? /* html */ `<div id="${MODULE_NAME}_compare_content">${renderCompareView()}</div>`
          : renderResultContent(displayResult, state.activeStage);

    // Only show history section if there's actual history
    const historySection = hasHistory
        ? /* html */ `
            <div class="cr-history ${cx(!state.historyExpanded && 'cr-history--collapsed')}">
                <button class="cr-history__toggle"
                        type="button"
                        aria-expanded="${state.historyExpanded}"
                        title="Previous pipeline runs in this session">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                    <span>Run History (${state.iterationHistory.length})</span>
                    <i class="fa-solid fa-chevron-down cr-history__toggle-icon"></i>
                </button>
                <div id="${MODULE_NAME}_history_list" class="cr-history__list cr-list">
                    ${state.iterationHistory
                        .map((r, i) => renderHistoryItem(r, i))
                        .join('')}
                </div>
            </div>
        `
        : '';

    return /* html */ `
        <div class="cr-results-wrapper">
            <!-- History Navigation (when viewing history) -->
            ${historyNavBar}

            <!-- View Toggle -->
            ${viewToggle ? /* html */ `<div class="cr-results-toolbar">${viewToggle}</div>` : ''}

            <!-- Results/Compare content -->
            <div id="${MODULE_NAME}_results_content" class="cr-results-content">
                ${content}
            </div>

            <!-- Run History Section (only if there's history) -->
            ${historySection}
        </div>
    `;
};
export const renderResultsPanel = withRenderBoundary(_renderResultsPanel, {
    name: 'ResultsPanel',
});
