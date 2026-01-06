// src/ui/components/results-panel/events.ts
// =============================================================================
// EVENT HANDLING
// =============================================================================

import { MODULE_NAME, toast, log } from '../../../shared';
import {
    getState,
    toggleHistory,
    viewHistoryItem,
    viewPreviousHistory,
    viewNextHistory,
    restoreHistoryItem,
} from '../../../state';
import { $, on } from '../base';
import { bindCompareViewEvents } from '../compare-view';
import { showApplyDialog } from '../apply-suggestions';
import type { StageName } from '../../../types';
import {
    getViewMode,
    setViewMode,
    getJsonDisplayMode,
    setJsonDisplayMode,
    getTextDisplayMode,
    setTextDisplayMode,
    getCompareViewCleanup,
    setCompareViewCleanup,
} from './state';
import { updateResults } from './update';
import { copyToClipboard } from './clipboard';

// =============================================================================
// EVENT BINDING
// =============================================================================

/**
 * Bind results panel events.
 */
export function bindResultsPanelEvents(container: HTMLElement): () => void {
    const cleanups: Array<() => void> = [];

    // View toggle buttons (result/compare)
    cleanups.push(
        on(container, 'click', (e) => {
            const btn = (e.target as HTMLElement).closest(
                '.cr-view-toggle__btn',
            );
            if (!btn) return;

            const view = (btn as HTMLElement).dataset.view as
                | 'result'
                | 'compare';
            if (view && view !== getViewMode()) {
                // Clean up previous compare view listeners before switching
                const cleanup = getCompareViewCleanup();
                if (cleanup) {
                    cleanup();
                    setCompareViewCleanup(null);
                }

                setViewMode(view);
                updateResults();

                // Bind compare view events if switching to compare
                if (view === 'compare') {
                    const compareContent = $(`#${MODULE_NAME}_compare_content`);
                    if (compareContent) {
                        setCompareViewCleanup(
                            bindCompareViewEvents(compareContent),
                        );
                    }
                }
            }
        }),
    );

    // JSON display mode toggle (smart/raw) - per-stage
    cleanups.push(
        on(container, 'click', (e) => {
            const btn = (e.target as HTMLElement).closest(
                '.cr-json-toggle__btn',
            );
            if (!btn) return;

            const toggle = btn.closest('.cr-json-toggle') as HTMLElement;
            const stage = toggle?.dataset.stage as StageName | undefined;
            if (!stage) return;

            const mode = (btn as HTMLElement).dataset.mode as 'smart' | 'raw';
            if (mode && mode !== getJsonDisplayMode(stage)) {
                setJsonDisplayMode(stage, mode);
                updateResults();
            }
        }),
    );

    // Text display mode toggle (formatted/raw) - per-stage
    cleanups.push(
        on(container, 'click', (e) => {
            const btn = (e.target as HTMLElement).closest(
                '.cr-text-toggle__btn',
            );
            if (!btn) return;

            const toggle = btn.closest('.cr-text-toggle') as HTMLElement;
            const stage = toggle?.dataset.stage as StageName | undefined;
            if (!stage) return;

            const mode = (btn as HTMLElement).dataset.mode as
                | 'formatted'
                | 'raw';
            if (mode && mode !== getTextDisplayMode(stage)) {
                setTextDisplayMode(stage, mode);
                updateResults();
            }
        }),
    );

    // Apply button
    cleanups.push(
        on(container, 'click', (e) => {
            const applyBtn = (e.target as HTMLElement).closest('.cr-apply-btn');
            if (!applyBtn) return;

            showApplyDialog();
        }),
    );

    // Copy buttons (event delegation) - mode-aware copying per-stage
    const resultsContent = $(`#${MODULE_NAME}_results_content`, container);
    if (resultsContent) {
        cleanups.push(
            on(resultsContent, 'click', async (e) => {
                const copyBtn = (e.target as HTMLElement).closest(
                    '.cr-result-copy',
                );
                if (!copyBtn) return;

                const btnElement = copyBtn as HTMLElement;
                const contentType = btnElement.dataset.type;
                const stage = btnElement.dataset.stage as StageName | undefined;
                let content: string;

                // Select content based on current view mode (per-stage)
                if (contentType === 'json' && stage) {
                    // For JSON: smart mode = formatted, raw mode = raw
                    content =
                        getJsonDisplayMode(stage) === 'smart'
                            ? decodeURIComponent(
                                  btnElement.dataset.formatted || '',
                              )
                            : decodeURIComponent(btnElement.dataset.raw || '');
                } else {
                    // For text: always use raw (markdown source)
                    content = decodeURIComponent(btnElement.dataset.raw || '');
                }

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
                    log.error('Failed to copy to clipboard');
                }
            }),
        );
    }

    // History toggle - use event delegation since history section is created dynamically
    cleanups.push(
        on(container, 'click', (e) => {
            const target = e.target as HTMLElement;
            const historyToggle = target.closest('.cr-history__toggle');
            if (!historyToggle) return;

            const historySection = historyToggle.closest('.cr-history');
            if (!historySection) return;

            toggleHistory();
            historySection.classList.toggle('cr-history--collapsed');
            historyToggle.setAttribute(
                'aria-expanded',
                String(getState().historyExpanded),
            );
        }),
    );

    // History navigation controls
    cleanups.push(
        on(container, 'click', (e) => {
            const target = e.target as HTMLElement;

            // Previous button
            if (target.closest(`#${MODULE_NAME}_history_prev`)) {
                viewPreviousHistory();
                updateResults();
                return;
            }

            // Next button
            if (target.closest(`#${MODULE_NAME}_history_next`)) {
                viewNextHistory();
                updateResults();
                return;
            }

            // Restore button (in nav bar)
            if (target.closest(`#${MODULE_NAME}_history_restore`)) {
                restoreHistoryItem();
                toast.success('Result restored');
                updateResults();
                return;
            }

            // Back to current button
            if (target.closest(`#${MODULE_NAME}_history_back`)) {
                viewHistoryItem(null);
                updateResults();
                return;
            }
        }),
    );

    // History item interactions - use event delegation from container
    // since history list is created dynamically after results exist
    cleanups.push(
        on(container, 'click', (e) => {
            const target = e.target as HTMLElement;

            // Only handle clicks within the history list
            const historyList = target.closest(`#${MODULE_NAME}_history_list`);
            if (!historyList) return;

            // Restore button on individual item
            const restoreBtn = target.closest('.cr-history-restore');
            if (restoreBtn) {
                e.stopPropagation();
                const index = parseInt(
                    (restoreBtn as HTMLElement).dataset.index || '0',
                    10,
                );
                restoreHistoryItem(index);
                toast.success('Result restored');
                updateResults();
                return;
            }

            // Click on item content - view in main panel
            const item = target.closest('.cr-list-item');
            if (!item) return;

            const index = parseInt(
                (item as HTMLElement).dataset.index || '0',
                10,
            );

            // View this history item in the main panel
            viewHistoryItem(index);
            updateResults();
        }),
    );

    return () => {
        // Clean up compare view listeners if any
        const cleanup = getCompareViewCleanup();
        if (cleanup) {
            cleanup();
            setCompareViewCleanup(null);
        }
        cleanups.forEach((fn) => fn());
    };
}
