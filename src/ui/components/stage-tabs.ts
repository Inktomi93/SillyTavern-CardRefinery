// src/ui/components/stage-tabs.ts
// =============================================================================
// STAGE TABS - Horizontal navigation tabs with run controls
// =============================================================================
//
// This component is purely presentational. Pipeline execution logic lives in
// state/pipeline-actions.ts to maintain clean layer separation.
//
// =============================================================================

import { MODULE_NAME, STAGES, STAGE_LABELS, STAGE_ICONS } from '../../shared';
import {
    getState,
    setActiveStage,
    executeStageAction,
    executeAllStagesAction,
    executeQuickIterateAction,
    abortPipelineAction,
    resetPipelineAction,
    setUserGuidance,
    getUserGuidance,
} from '../../state';
import { $, on, cx } from './base';
import { updateStageConfig } from './stage-config';
import { updateResults } from './results-panel';
import type { StageName, StageStatus } from '../../types';

// =============================================================================
// STATUS CONFIGURATION
// =============================================================================

const STATUS_ICONS: Record<StageStatus, string> = {
    pending: '',
    running: 'fa-spinner fa-spin',
    complete: 'fa-check',
    error: 'fa-exclamation',
};

const STATUS_CLASSES: Record<StageStatus, string> = {
    pending: '',
    running: 'cr-stage-tab--running',
    complete: 'cr-stage-tab--complete',
    error: 'cr-stage-tab--error',
};

// =============================================================================
// HTML TEMPLATES
// =============================================================================

function renderStageTab(stage: StageName): string {
    const state = getState();
    const isActive = state.activeStage === stage;
    const status = state.stageStatus[stage];

    const statusIcon = STATUS_ICONS[status];
    const statusBadge = statusIcon
        ? `<span class="cr-stage-tab__status"><i class="fa-solid ${statusIcon}"></i></span>`
        : '';

    return `
        <button class="cr-stage-tab ${cx(isActive && 'cr-stage-tab--active')} ${STATUS_CLASSES[status]}"
                data-stage="${stage}"
                role="tab"
                aria-selected="${isActive}"
                type="button">
            <i class="fa-solid ${STAGE_ICONS[stage]} cr-stage-tab__icon"></i>
            <span class="cr-stage-tab__label">${STAGE_LABELS[stage]}</span>
            ${statusBadge}
        </button>
    `;
}

/**
 * Render stage tabs navigation.
 */
export function renderStageTabs(): string {
    return `
        <nav class="cr-stage-tabs" role="tablist" aria-label="Pipeline stages">
            ${STAGES.map(renderStageTab).join('')}
        </nav>
    `;
}

/**
 * Render pipeline controls (run buttons, status).
 *
 * Simplified design:
 * - Primary row: Run [Stage], Run All, Reset
 * - Iteration row (only after analyze): Guidance input + Iterate button
 */
export function renderPipelineControls(): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const state = getState();
    const canRun = state.character && !state.isGenerating;

    // Iteration is available when analyze has completed successfully
    const canIterate =
        canRun &&
        state.stageResults.analyze &&
        !state.stageResults.analyze.error;

    // Generating state - show spinner and stop button
    if (state.isGenerating) {
        return `
            <div class="cr-pipeline-controls cr-pipeline-controls--generating">
                <div class="cr-pipeline-status">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <span>Generating...</span>
                </div>
                <button id="${MODULE_NAME}_abort"
                        class="menu_button menu_button--danger menu_button--sm"
                        type="button">
                    <i class="fa-solid fa-stop"></i>
                    Stop
                </button>
            </div>
        `;
    }

    // Iteration row - only shown when iterate is available
    const iterationRow = canIterate
        ? `
        <div class="cr-iteration-row">
            <div class="cr-iteration-row__label">
                <i class="fa-solid fa-arrows-rotate"></i>
                <span>Iteration ${state.iterationCount + 1}</span>
            </div>
            <input type="text"
                   id="${MODULE_NAME}_guidance_input"
                   class="cr-iteration-row__input"
                   placeholder="Optional guidance to steer refinement..."
                   value="${DOMPurify.sanitize(getUserGuidance())}"
                   title="Focus areas or constraints for the next iteration" />
            <button id="${MODULE_NAME}_iterate"
                    class="menu_button menu_button--primary"
                    type="button"
                    title="Refine with feedback, then re-analyze">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                Iterate
            </button>
        </div>
    `
        : '';

    return `
        <div class="cr-pipeline-controls">
            <div class="cr-pipeline-controls__main">
                <button id="${MODULE_NAME}_run_stage"
                        class="menu_button menu_button--primary"
                        type="button"
                        ${!canRun ? 'disabled' : ''}>
                    <i class="fa-solid fa-play"></i>
                    Run ${STAGE_LABELS[state.activeStage]}
                </button>
                <button id="${MODULE_NAME}_run_all"
                        class="menu_button"
                        type="button"
                        ${!canRun ? 'disabled' : ''}
                        title="Run all stages: Score → Rewrite → Analyze">
                    <i class="fa-solid fa-forward"></i>
                    Run All
                </button>
                <button id="${MODULE_NAME}_reset"
                        class="menu_button menu_button--icon menu_button--ghost"
                        type="button"
                        title="Clear all results and start fresh">
                    <i class="fa-solid fa-rotate-left"></i>
                </button>
            </div>
            ${iterationRow}
        </div>
    `;
}

/**
 * Update stage tabs display.
 */
export function updateStageTabs(): void {
    const tabsContainer = $('.cr-stage-tabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = STAGES.map(renderStageTab).join('');
}

/**
 * Update pipeline controls display.
 */
export function updatePipelineControls(): void {
    const controlsContainer = $(`#${MODULE_NAME}_pipeline_controls`);
    if (!controlsContainer) return;

    controlsContainer.innerHTML = renderPipelineControls();
    bindPipelineControlEvents(controlsContainer);
}

// =============================================================================
// PIPELINE EXECUTION (delegates to state layer)
// =============================================================================

/**
 * Execute a single stage via state action.
 * UI updates are triggered through callbacks.
 */
async function executeStage(stage: StageName): Promise<void> {
    const state = getState();

    // Update UI before execution starts
    updateStageTabs();
    updatePipelineControls();

    await executeStageAction(state, {
        stage,
        callbacks: {
            onStageStart: () => {
                updateStageTabs();
                updatePipelineControls();
            },
            onStageComplete: () => {
                updateResults();
                updateStageTabs();
                updatePipelineControls();
            },
            onError: () => {
                updateStageTabs();
                updatePipelineControls();
            },
        },
    });
}

/**
 * Execute all stages via state action.
 * UI updates are triggered through callbacks.
 */
async function executeAllStages(): Promise<void> {
    const state = getState();

    // Update UI before execution starts
    updateStageTabs();
    updatePipelineControls();

    await executeAllStagesAction(state, {
        callbacks: {
            onStageStart: () => {
                updateStageTabs();
            },
            onStageComplete: () => {
                updateResults();
                updateStageTabs();
            },
            onProgress: () => {
                updatePipelineControls();
            },
            onError: () => {
                updateStageTabs();
                updatePipelineControls();
            },
        },
    });

    // Final UI update
    updateStageTabs();
    updatePipelineControls();
}

/**
 * Execute quick iterate via state action.
 * Runs Refine (rewrite with feedback) → Analyze in one click.
 */
async function executeQuickIterate(): Promise<void> {
    const state = getState();

    // Update UI before execution starts
    updateStageTabs();
    updatePipelineControls();

    await executeQuickIterateAction(state, {
        callbacks: {
            onStageStart: (stage) => {
                updateStageTabs();
                updatePipelineControls();
            },
            onStageComplete: () => {
                updateResults();
                updateStageTabs();
                updatePipelineControls();
            },
            onError: () => {
                updateStageTabs();
                updatePipelineControls();
            },
            onIterateComplete: () => {
                // Switch to analyze tab to show the new analysis
                setActiveStage('analyze');
                updateStageTabs();
                updateStageConfig();
                updateResults();
            },
        },
    });
}

// =============================================================================
// EVENT BINDING
// =============================================================================

// Store cleanup for pipeline control events
let pipelineControlCleanups: Array<() => void> = [];

/**
 * Bind pipeline control events (called after updating controls).
 * Properly cleans up old listeners before adding new ones.
 */
function bindPipelineControlEvents(container: HTMLElement): void {
    // Cleanup old listeners first
    pipelineControlCleanups.forEach((fn) => fn());
    pipelineControlCleanups = [];

    // Guidance input (updates on change/blur)
    const guidanceInput = $(
        `#${MODULE_NAME}_guidance_input`,
        container,
    ) as HTMLInputElement;
    if (guidanceInput) {
        const updateGuidance = () => {
            setUserGuidance(guidanceInput.value);
        };
        pipelineControlCleanups.push(
            on(guidanceInput, 'change', updateGuidance),
        );
        pipelineControlCleanups.push(on(guidanceInput, 'blur', updateGuidance));
    }

    // Run current stage
    const runStageBtn = $(`#${MODULE_NAME}_run_stage`, container);
    if (runStageBtn) {
        pipelineControlCleanups.push(
            on(runStageBtn, 'click', () => {
                const state = getState();
                executeStage(state.activeStage);
            }),
        );
    }

    // Run all stages
    const runAllBtn = $(`#${MODULE_NAME}_run_all`, container);
    if (runAllBtn) {
        pipelineControlCleanups.push(
            on(runAllBtn, 'click', () => {
                executeAllStages();
            }),
        );
    }

    // Iterate (refine + analyze)
    const iterateBtn = $(`#${MODULE_NAME}_iterate`, container);
    if (iterateBtn) {
        pipelineControlCleanups.push(
            on(iterateBtn, 'click', () => {
                executeQuickIterate();
            }),
        );
    }

    // Reset pipeline
    const resetBtn = $(`#${MODULE_NAME}_reset`, container);
    if (resetBtn) {
        pipelineControlCleanups.push(
            on(resetBtn, 'click', () => {
                resetPipelineAction(getState());
                updateStageTabs();
                updateResults();
                updatePipelineControls();
            }),
        );
    }

    // Abort generation
    const abortBtn = $(`#${MODULE_NAME}_abort`, container);
    if (abortBtn) {
        pipelineControlCleanups.push(
            on(abortBtn, 'click', () => {
                abortPipelineAction(getState());
                updateStageTabs();
                updatePipelineControls();
            }),
        );
    }
}

/**
 * Cleanup pipeline control event listeners.
 */
export function cleanupPipelineControls(): void {
    pipelineControlCleanups.forEach((fn) => fn());
    pipelineControlCleanups = [];
}

/**
 * Bind stage tabs events.
 */
export function bindStageTabsEvents(container: HTMLElement): () => void {
    const cleanups: Array<() => void> = [];

    // Tab clicks
    const tabsContainer = $('.cr-stage-tabs', container);
    if (tabsContainer) {
        cleanups.push(
            on(tabsContainer, 'click', (e) => {
                const target = e.target as HTMLElement;
                const tab = target.closest('.cr-stage-tab') as HTMLElement;
                if (!tab) return;

                const stage = tab.dataset.stage as StageName;
                if (stage) {
                    setActiveStage(stage);
                    updateStageTabs();
                    updateStageConfig();
                    updateResults();
                    updatePipelineControls();
                }
            }),
        );
    }

    // Pipeline controls
    const controlsContainer = $(`#${MODULE_NAME}_pipeline_controls`, container);
    if (controlsContainer) {
        bindPipelineControlEvents(controlsContainer);
    }

    return () => {
        cleanups.forEach((fn) => fn());
    };
}
