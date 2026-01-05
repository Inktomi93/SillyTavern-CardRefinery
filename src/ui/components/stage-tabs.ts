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
    toggleStageSelection,
    executeStageAction,
    executeAllStagesAction,
    executeRefinementAction,
    executeQuickIterateAction,
    abortPipelineAction,
    resetPipelineAction,
} from '../../state';
import { toast } from '../../shared';
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
    running: 'ct-stage-tab--running',
    complete: 'ct-stage-tab--complete',
    error: 'ct-stage-tab--error',
};

// =============================================================================
// HTML TEMPLATES
// =============================================================================

function renderStageTab(stage: StageName): string {
    const state = getState();
    const isActive = state.activeStage === stage;
    const isSelected = state.selectedStages.includes(stage);
    const status = state.stageStatus[stage];

    const statusIcon = STATUS_ICONS[status];
    const statusBadge = statusIcon
        ? `<span class="ct-stage-tab__status"><i class="fa-solid ${statusIcon}"></i></span>`
        : '';

    // Checkbox for stage selection (used by "Run Selected")
    const checkbox = `
        <input type="checkbox" 
               class="ct-stage-tab__checkbox"
               data-stage-checkbox="${stage}"
               ${isSelected ? 'checked' : ''}
               title="Include in 'Run Selected'"
               onclick="event.stopPropagation()">
    `;

    return `
        <button class="ct-stage-tab ${cx(isActive && 'ct-stage-tab--active')} ${STATUS_CLASSES[status]}"
                data-stage="${stage}"
                role="tab"
                aria-selected="${isActive}"
                type="button">
            ${checkbox}
            <i class="fa-solid ${STAGE_ICONS[stage]} ct-stage-tab__icon"></i>
            <span class="ct-stage-tab__label">${STAGE_LABELS[stage]}</span>
            ${statusBadge}
        </button>
    `;
}

/**
 * Render stage tabs navigation.
 */
export function renderStageTabs(): string {
    return `
        <nav class="ct-stage-tabs" role="tablist" aria-label="Pipeline stages">
            ${STAGES.map(renderStageTab).join('')}
        </nav>
    `;
}

/**
 * Render pipeline controls (run buttons, status).
 */
export function renderPipelineControls(): string {
    const state = getState();
    const canRun = state.character && !state.isGenerating;
    // Refine is available when analyze has completed successfully
    const canRefine =
        canRun &&
        state.stageResults.analyze &&
        !state.stageResults.analyze.error;

    // Check if there are selected stages for "Run Selected"
    const hasSelectedStages = state.selectedStages.length > 0;
    const selectedCount = state.selectedStages.length;

    if (state.isGenerating) {
        return `
            <div class="ct-pipeline-controls ct-pipeline-controls--generating">
                <div class="ct-pipeline-status">
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

    // Show iteration count if we've done refinements
    const iterationBadge =
        state.iterationCount > 0
            ? `<span class="ct-badge ct-badge--small ct-badge--muted" title="Refinement iteration">
                   <i class="fa-solid fa-rotate"></i> ${state.iterationCount}
               </span>`
            : '';

    // Selected stages indicator
    const selectedBadge =
        selectedCount < STAGES.length
            ? `<span class="ct-badge ct-badge--small" title="Stages selected for Run Selected">${selectedCount}/${STAGES.length}</span>`
            : '';

    return `
        <div class="ct-pipeline-controls">
            <button id="${MODULE_NAME}_run_stage"
                    class="menu_button menu_button--primary"
                    type="button"
                    ${!canRun ? 'disabled' : ''}>
                <i class="fa-solid fa-play"></i>
                Run ${STAGE_LABELS[state.activeStage]}
            </button>
            <button id="${MODULE_NAME}_run_selected"
                    class="menu_button"
                    type="button"
                    ${!canRun || !hasSelectedStages ? 'disabled' : ''}
                    title="Run checked stages in sequence">
                <i class="fa-solid fa-list-check"></i>
                Run Selected
                ${selectedBadge}
            </button>
            <button id="${MODULE_NAME}_run_all"
                    class="menu_button menu_button--ghost"
                    type="button"
                    ${!canRun ? 'disabled' : ''}
                    title="Run all stages in sequence">
                <i class="fa-solid fa-forward"></i>
                All
            </button>
            <button id="${MODULE_NAME}_refine"
                    class="menu_button ${canRefine ? '' : 'menu_button--disabled'}"
                    type="button"
                    ${!canRefine ? 'disabled' : ''}
                    title="Re-run rewrite using analyze feedback to refine the output">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                Refine
            </button>
            <button id="${MODULE_NAME}_iterate"
                    class="menu_button menu_button--primary ${canRefine ? '' : 'menu_button--disabled'}"
                    type="button"
                    ${!canRefine ? 'disabled' : ''}
                    title="Quick iterate: Refine then Analyze in one click">
                <i class="fa-solid fa-arrows-rotate"></i>
                Iterate
            </button>
            ${iterationBadge}
            <button id="${MODULE_NAME}_reset"
                    class="menu_button menu_button--icon menu_button--ghost"
                    type="button"
                    title="Reset pipeline">
                <i class="fa-solid fa-rotate-left"></i>
            </button>
        </div>
    `;
}

/**
 * Update stage tabs display.
 */
export function updateStageTabs(): void {
    const tabsContainer = $('.ct-stage-tabs');
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
// STAGE DEPENDENCY CHECKING
// =============================================================================

/** Stage dependency map - what results each stage benefits from */
const STAGE_DEPENDENCIES: Record<
    StageName,
    { required: StageName[]; recommended: StageName[] }
> = {
    score: { required: [], recommended: [] },
    rewrite: { required: [], recommended: ['score'] },
    analyze: { required: ['rewrite'], recommended: ['score'] },
};

/**
 * Check if running a stage without prerequisites.
 * Returns warnings for missing dependencies.
 */
function checkStageDependencies(
    stages: StageName[],
    existingResults: Record<StageName, unknown>,
): {
    stage: StageName;
    missing: string;
    severity: 'required' | 'recommended';
}[] {
    const warnings: {
        stage: StageName;
        missing: string;
        severity: 'required' | 'recommended';
    }[] = [];

    for (const stage of stages) {
        const deps = STAGE_DEPENDENCIES[stage];

        // Check required dependencies
        for (const req of deps.required) {
            if (!stages.includes(req) && !existingResults[req]) {
                warnings.push({
                    stage,
                    missing: STAGE_LABELS[req],
                    severity: 'required',
                });
            }
        }

        // Check recommended dependencies
        for (const rec of deps.recommended) {
            if (!stages.includes(rec) && !existingResults[rec]) {
                warnings.push({
                    stage,
                    missing: STAGE_LABELS[rec],
                    severity: 'recommended',
                });
            }
        }
    }

    return warnings;
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
 * Execute only selected stages via state action.
 * Shows warnings for missing dependencies.
 */
async function executeSelectedStages(): Promise<void> {
    const state = getState();
    const selectedStages = state.selectedStages;

    if (selectedStages.length === 0) {
        toast.warning(
            'No stages selected. Check the boxes next to stage names.',
        );
        return;
    }

    // Check dependencies and show warnings
    const warnings = checkStageDependencies(selectedStages, state.stageResults);

    if (warnings.length > 0) {
        const requiredWarnings = warnings.filter(
            (w) => w.severity === 'required',
        );
        const recommendedWarnings = warnings.filter(
            (w) => w.severity === 'recommended',
        );

        // Required dependencies are blocking
        if (requiredWarnings.length > 0) {
            const missingList = requiredWarnings
                .map((w) => `${STAGE_LABELS[w.stage]} requires ${w.missing}`)
                .join(', ');
            toast.error(`Missing required stages: ${missingList}`);
            return;
        }

        // Recommended dependencies show a warning but continue
        if (recommendedWarnings.length > 0) {
            const missingList = recommendedWarnings
                .map(
                    (w) =>
                        `${STAGE_LABELS[w.stage]} works better with ${w.missing}`,
                )
                .join('; ');
            toast.warning(`Note: ${missingList}. Running anyway...`);
        }
    }

    // Update UI before execution starts
    updateStageTabs();
    updatePipelineControls();

    await executeAllStagesAction(state, {
        stages: selectedStages,
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
 * Execute refinement via state action.
 * Re-runs rewrite with analyze feedback to refine the output.
 */
async function executeRefinement(): Promise<void> {
    const state = getState();

    // Update UI before execution starts
    updateStageTabs();
    updatePipelineControls();

    await executeRefinementAction(state, {
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

    const runStageBtn = $(`#${MODULE_NAME}_run_stage`, container);
    if (runStageBtn) {
        pipelineControlCleanups.push(
            on(runStageBtn, 'click', () => {
                const state = getState();
                executeStage(state.activeStage);
            }),
        );
    }

    const runSelectedBtn = $(`#${MODULE_NAME}_run_selected`, container);
    if (runSelectedBtn) {
        pipelineControlCleanups.push(
            on(runSelectedBtn, 'click', () => {
                executeSelectedStages();
            }),
        );
    }

    const runAllBtn = $(`#${MODULE_NAME}_run_all`, container);
    if (runAllBtn) {
        pipelineControlCleanups.push(
            on(runAllBtn, 'click', () => {
                executeAllStages();
            }),
        );
    }

    const refineBtn = $(`#${MODULE_NAME}_refine`, container);
    if (refineBtn) {
        pipelineControlCleanups.push(
            on(refineBtn, 'click', () => {
                executeRefinement();
            }),
        );
    }

    const iterateBtn = $(`#${MODULE_NAME}_iterate`, container);
    if (iterateBtn) {
        pipelineControlCleanups.push(
            on(iterateBtn, 'click', () => {
                executeQuickIterate();
            }),
        );
    }

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
    const tabsContainer = $('.ct-stage-tabs', container);
    if (tabsContainer) {
        // Stage tab click (switch active stage)
        cleanups.push(
            on(tabsContainer, 'click', (e) => {
                const target = e.target as HTMLElement;

                // Ignore checkbox clicks - handled separately
                if (target.classList.contains('ct-stage-tab__checkbox')) {
                    return;
                }

                const tab = target.closest('.ct-stage-tab') as HTMLElement;
                if (!tab) return;

                const stage = tab.dataset.stage as StageName;
                if (stage) {
                    setActiveStage(stage);
                    updateStageTabs();
                    updateStageConfig();
                    updateResults(); // Also update results when switching stages
                }
            }),
        );

        // Stage checkbox change (toggle stage selection)
        cleanups.push(
            on(tabsContainer, 'change', (e) => {
                const target = e.target as HTMLInputElement;
                if (!target.dataset.stageCheckbox) return;

                const stage = target.dataset.stageCheckbox as StageName;
                toggleStageSelection(stage);
                updatePipelineControls(); // Update button badge
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
