// src/ui/components/results-panel/update.ts
// =============================================================================
// UPDATE LOGIC
// =============================================================================

import { MODULE_NAME } from '../../../shared';
import { getState, getViewedHistoryItem } from '../../../state';
import { $, morphUpdate } from '../base';
import { renderCompareView } from '../compare-view';
import { getViewMode } from './state';
import { renderResultContent, renderHistoryItem } from './templates';

// =============================================================================
// UPDATE FUNCTION
// =============================================================================

/**
 * Update results display.
 */
export function updateResults(): void {
    const state = getState();
    const viewedHistoryItem = getViewedHistoryItem();
    const isViewingHistory = viewedHistoryItem !== null;
    const currentViewMode = getViewMode();

    const hasRewrite = !!state.stageResults.rewrite;
    const hasHistory = state.iterationHistory.length > 0;

    // Only show compare on rewrite tab and when not viewing history
    const showCompareToggle =
        hasRewrite && !isViewingHistory && state.activeStage === 'rewrite';

    // Show Apply button when viewing rewrite results (not in history view)
    const hasUpdates =
        !isViewingHistory && hasRewrite && state.activeStage === 'rewrite';

    const resultsWrapper = $('.cr-results-wrapper');
    if (!resultsWrapper) return;

    // Update or manage history nav bar
    let historyNavBar = resultsWrapper.querySelector(
        '.cr-history-nav',
    ) as HTMLElement | null;

    if (isViewingHistory) {
        const historyNavHtml = /* html */ `
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
        `;

        if (!historyNavBar) {
            historyNavBar = document.createElement('div');
            historyNavBar.className = 'cr-history-nav';
            resultsWrapper.insertBefore(
                historyNavBar,
                resultsWrapper.firstChild,
            );
        }
        historyNavBar.innerHTML = historyNavHtml;
    } else if (historyNavBar) {
        historyNavBar.remove();
    }

    // Update or create the view toggle toolbar
    let toolbar = resultsWrapper.querySelector(
        '.cr-results-toolbar',
    ) as HTMLElement | null;

    if (showCompareToggle) {
        const viewToggleHtml = /* html */ `
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
        `;

        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.className = 'cr-results-toolbar';
            const resultsContent = $(`#${MODULE_NAME}_results_content`);
            if (resultsContent) {
                resultsWrapper.insertBefore(toolbar, resultsContent);
            }
        }
        toolbar.innerHTML = viewToggleHtml;
    } else if (toolbar) {
        toolbar.remove();
    }

    // Update content based on view mode and history state
    const container = $(`#${MODULE_NAME}_results_content`);
    if (!container) return;

    if (isViewingHistory) {
        // Show the viewed history item
        container.innerHTML = renderResultContent(
            viewedHistoryItem,
            viewedHistoryItem?.stage ?? state.activeStage,
        );
    } else if (currentViewMode === 'compare' && showCompareToggle) {
        container.innerHTML = /* html */ `<div id="${MODULE_NAME}_compare_content">${renderCompareView()}</div>`;
    } else {
        // Show current stage result
        const activeResult = state.stageResults[state.activeStage];
        container.innerHTML = renderResultContent(
            activeResult,
            state.activeStage,
        );
    }

    // Update or create history section
    let historySection = resultsWrapper.querySelector(
        '.cr-history',
    ) as HTMLElement | null;

    if (hasHistory) {
        if (!historySection) {
            historySection = document.createElement('div');
            historySection.className = `cr-history ${!state.historyExpanded ? 'cr-history--collapsed' : ''}`;
            historySection.innerHTML = /* html */ `
                <button class="cr-history__toggle"
                        type="button"
                        aria-expanded="${state.historyExpanded}"
                        title="Previous pipeline runs in this session">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                    <span>Run History (${state.iterationHistory.length})</span>
                    <i class="fa-solid fa-chevron-down cr-history__toggle-icon"></i>
                </button>
                <div id="${MODULE_NAME}_history_list" class="cr-history__list cr-list">
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
            '.cr-history__toggle span',
        );
        if (toggleSpan) {
            toggleSpan.textContent = `Run History (${state.iterationHistory.length})`;
        }
    } else if (historySection) {
        historySection.remove();
    }
}
