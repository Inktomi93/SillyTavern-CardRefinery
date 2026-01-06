// src/state/pipeline-actions.ts
// =============================================================================
// PIPELINE EXECUTION ACTIONS
// =============================================================================
//
// Orchestrates pipeline execution at the state layer, keeping UI components
// focused purely on presentation. This separation enables:
// - Testable execution logic without DOM dependencies
// - Reusable pipeline triggers from multiple sources
// - Clean single-responsibility for UI components
//
// =============================================================================

import { STAGES, log } from '../shared';
import {
    runStage,
    type ExecutionDependencies,
    type StageContext,
} from '../domain';
import {
    getPromptPreset,
    getSchemaPreset,
    getSystemPrompt,
    getRefinementPrompt,
} from '../data';
import type { StageName, StageResult, PopupState } from '../types';
import { getFieldSelectionForStage, ensureActiveSession } from './popup-state';

// =============================================================================
// TYPES
// =============================================================================

export interface PipelineCallbacks {
    onStageStart?: (stage: StageName) => void;
    onStageComplete?: (stage: StageName, result: StageResult) => void;
    onProgress?: (message: string) => void;
    onError?: (stage: StageName, error: string) => void;
}

export interface ExecuteStageOptions {
    stage: StageName;
    callbacks?: PipelineCallbacks;
}

export interface ExecuteAllOptions {
    stages?: StageName[];
    callbacks?: PipelineCallbacks;
}

// =============================================================================
// DEPENDENCIES
// =============================================================================

/**
 * Execution dependencies - constructed once at the state layer.
 * This keeps the domain layer pure and the UI layer unaware of data access.
 */
const deps: ExecutionDependencies = {
    getPromptPreset,
    getSchemaPreset,
    getSystemPrompt,
    getRefinementPrompt,
};

// =============================================================================
// STATE MUTATION HELPERS
// =============================================================================

/**
 * Update state for stage status.
 * These are inline mutations to avoid circular imports with popup-state.
 */
function setStageStatusInState(
    state: PopupState,
    stage: StageName,
    status: 'pending' | 'running' | 'complete' | 'error',
): void {
    state.stageStatus[stage] = status;
}

function setGeneratingInState(
    state: PopupState,
    generating: boolean,
    controller?: AbortController,
): void {
    state.isGenerating = generating;
    state.abortController = generating
        ? (controller ?? new AbortController())
        : null;
}

/**
 * Conditionally clear generating state only if this controller is still active.
 * Prevents race condition where old pipeline clears state for new pipeline.
 */
function clearGeneratingIfOwned(
    state: PopupState,
    controller: AbortController,
): void {
    // Only clear if this controller is still the active one
    if (state.abortController === controller) {
        state.isGenerating = false;
        state.abortController = null;
    }
}

function recordResultInState(state: PopupState, result: StageResult): void {
    state.stageResults[result.stage] = result;
    state.stageStatus[result.stage] = result.error ? 'error' : 'complete';
    state.iterationHistory.push(result);
    state.hasUnsavedChanges = true;
}

// =============================================================================
// CONTEXT BUILDING
// =============================================================================

/**
 * Build stage context from current state.
 */
function buildStageContext(
    state: PopupState,
    stage: StageName,
): StageContext | null {
    if (!state.character) return null;

    return {
        character: state.character,
        selection: getFieldSelectionForStage(stage),
        stage,
        config: state.stageConfigs[stage],
        previousResults: state.stageResults,
        iterationCount: state.iterationCount,
        guidance: state.userGuidance || undefined,
    };
}

// =============================================================================
// EXECUTION FUNCTIONS
// =============================================================================

/**
 * Execute a single pipeline stage.
 *
 * @param state - Current popup state (will be mutated)
 * @param options - Execution options
 * @returns The stage result, or null if execution couldn't start
 *
 * @example
 * ```ts
 * const result = await executeStageAction(getState(), {
 *     stage: 'score',
 *     callbacks: {
 *         onStageStart: () => updateUI(),
 *         onStageComplete: () => updateUI(),
 *     }
 * });
 * ```
 */
export async function executeStageAction(
    state: PopupState,
    options: ExecuteStageOptions,
): Promise<StageResult | null> {
    const { stage, callbacks } = options;

    // Validation
    if (!state.character) {
        log.warn('Cannot execute stage: no character selected');
        return null;
    }

    if (state.isGenerating) {
        log.warn('Cannot execute stage: generation already in progress');
        return null;
    }

    // Ensure we have an active session (lazy creation)
    await ensureActiveSession();

    // Build context
    const context = buildStageContext(state, stage);
    if (!context) return null;

    // Setup
    const controller = new AbortController();
    setGeneratingInState(state, true, controller);
    setStageStatusInState(state, stage, 'running');

    callbacks?.onStageStart?.(stage);

    try {
        const result = await runStage(context, deps, {
            signal: controller.signal,
            onProgress: (msg) => {
                log.debug(`[Pipeline] ${msg}`);
                callbacks?.onProgress?.(msg);
            },
        });

        recordResultInState(state, result);
        callbacks?.onStageComplete?.(stage, result);

        if (result.error) {
            callbacks?.onError?.(stage, result.error);
        }

        return result;
    } catch (error) {
        const errorMsg =
            error instanceof Error ? error.message : 'Unknown error';
        log.error(`Stage ${stage} failed:`, error);

        setStageStatusInState(state, stage, 'error');
        callbacks?.onError?.(stage, errorMsg);

        return null;
    } finally {
        clearGeneratingIfOwned(state, controller);
    }
}

/**
 * Execute multiple stages in sequence.
 *
 * @param state - Current popup state (will be mutated)
 * @param options - Execution options
 * @returns Map of stage results
 *
 * @example
 * ```ts
 * const results = await executeAllStagesAction(getState(), {
 *     callbacks: {
 *         onStageStart: (stage) => highlightTab(stage),
 *         onProgress: (msg) => showProgress(msg),
 *     }
 * });
 * ```
 */
export async function executeAllStagesAction(
    state: PopupState,
    options: ExecuteAllOptions = {},
): Promise<Record<StageName, StageResult | null>> {
    const { stages = [...STAGES], callbacks } = options;

    // Validation
    if (!state.character) {
        log.warn('Cannot execute pipeline: no character selected');
        return { score: null, rewrite: null, analyze: null };
    }

    if (state.isGenerating) {
        log.warn('Cannot execute pipeline: generation already in progress');
        return { score: null, rewrite: null, analyze: null };
    }

    // Setup
    const controller = new AbortController();
    setGeneratingInState(state, true, controller);

    // Mark all stages as pending initially
    for (const stage of STAGES) {
        setStageStatusInState(state, stage, 'pending');
    }

    const results: Record<StageName, StageResult | null> = {
        score: state.stageResults.score,
        rewrite: state.stageResults.rewrite,
        analyze: state.stageResults.analyze,
    };

    try {
        for (const stage of stages) {
            // Check for abort
            if (controller.signal.aborted) {
                log.debug('Pipeline aborted');
                break;
            }

            // Build fresh context with accumulated results
            const context = buildStageContext(state, stage);
            if (!context) break;

            // Update context with current results
            context.previousResults = results;

            setStageStatusInState(state, stage, 'running');
            callbacks?.onStageStart?.(stage);
            callbacks?.onProgress?.(`Running ${stage}...`);

            const result = await runStage(context, deps, {
                signal: controller.signal,
                onProgress: (msg) => {
                    log.debug(`[Pipeline] ${msg}`);
                    callbacks?.onProgress?.(msg);
                },
            });

            results[stage] = result;
            recordResultInState(state, result);
            callbacks?.onStageComplete?.(stage, result);

            // Stop on error
            if (result.error) {
                callbacks?.onError?.(stage, result.error);
                break;
            }
        }
    } catch (error) {
        const errorMsg =
            error instanceof Error ? error.message : 'Unknown error';
        log.error('Pipeline execution failed:', error);
        callbacks?.onError?.(state.activeStage, errorMsg);
    } finally {
        clearGeneratingIfOwned(state, controller);
    }

    return results;
}

/**
 * Execute quick iterate: Refine (rewrite with analyze feedback) → Analyze in sequence.
 *
 * This combines refinement and analysis into a single action for rapid iteration:
 * 1. Runs rewrite with isRefinement=true (includes analyze feedback)
 * 2. Runs analyze on the new rewrite result
 * 3. Increments iteration counter once
 *
 * @param state - Current popup state (will be mutated)
 * @param options - Execution options with extended callbacks
 * @returns Object with both results, or nulls if execution couldn't complete
 */
export async function executeQuickIterateAction(
    state: PopupState,
    options: {
        callbacks?: PipelineCallbacks & { onIterateComplete?: () => void };
    } = {},
): Promise<{ rewrite: StageResult | null; analyze: StageResult | null }> {
    const { callbacks } = options;

    // Validation
    if (!state.character) {
        log.warn('Cannot execute quick iterate: no character selected');
        return { rewrite: null, analyze: null };
    }

    if (state.isGenerating) {
        log.warn(
            'Cannot execute quick iterate: generation already in progress',
        );
        return { rewrite: null, analyze: null };
    }

    // Quick iterate requires a previous analyze result
    if (!state.stageResults.analyze) {
        log.warn('Cannot execute quick iterate: no analyze result available');
        return { rewrite: null, analyze: null };
    }

    // Setup
    const controller = new AbortController();
    setGeneratingInState(state, true, controller);

    // Increment iteration count before running
    state.iterationCount++;

    const results: {
        rewrite: StageResult | null;
        analyze: StageResult | null;
    } = {
        rewrite: null,
        analyze: null,
    };

    try {
        // Step 1: Run refinement (rewrite with analyze feedback)
        const rewriteContext = buildStageContext(state, 'rewrite');
        if (!rewriteContext) {
            return results;
        }
        rewriteContext.isRefinement = true;

        setStageStatusInState(state, 'rewrite', 'running');
        callbacks?.onStageStart?.('rewrite');
        callbacks?.onProgress?.('Refining rewrite with feedback...');

        const rewriteResult = await runStage(rewriteContext, deps, {
            signal: controller.signal,
            onProgress: (msg) => {
                log.debug(`[Pipeline] ${msg}`);
                callbacks?.onProgress?.(msg);
            },
        });

        results.rewrite = rewriteResult;
        recordResultInState(state, rewriteResult);
        callbacks?.onStageComplete?.('rewrite', rewriteResult);

        // Stop if rewrite failed
        if (rewriteResult.error) {
            callbacks?.onError?.('rewrite', rewriteResult.error);
            return results;
        }

        // Check for abort between stages
        if (controller.signal.aborted) {
            log.debug('Quick iterate aborted');
            return results;
        }

        // Step 2: Run analyze on the new rewrite
        const analyzeContext = buildStageContext(state, 'analyze');
        if (!analyzeContext) {
            return results;
        }
        // Update context with fresh rewrite result
        analyzeContext.previousResults = {
            ...state.stageResults,
            rewrite: rewriteResult,
        };

        setStageStatusInState(state, 'analyze', 'running');
        callbacks?.onStageStart?.('analyze');
        callbacks?.onProgress?.('Analyzing refined version...');

        const analyzeResult = await runStage(analyzeContext, deps, {
            signal: controller.signal,
            onProgress: (msg) => {
                log.debug(`[Pipeline] ${msg}`);
                callbacks?.onProgress?.(msg);
            },
        });

        results.analyze = analyzeResult;
        recordResultInState(state, analyzeResult);
        callbacks?.onStageComplete?.('analyze', analyzeResult);

        if (analyzeResult.error) {
            callbacks?.onError?.('analyze', analyzeResult.error);
        }

        callbacks?.onIterateComplete?.();
        return results;
    } catch (error) {
        const errorMsg =
            error instanceof Error ? error.message : 'Unknown error';
        log.error('Quick iterate failed:', error);
        callbacks?.onError?.(state.activeStage, errorMsg);
        return results;
    } finally {
        clearGeneratingIfOwned(state, controller);
    }
}

export function abortPipelineAction(state: PopupState): void {
    if (state.abortController) {
        state.abortController.abort();
        state.abortController = null;
        state.isGenerating = false;
        log.debug('Pipeline aborted by user');
    }
}

/**
 * Reset pipeline state (clear results, keep character & session).
 *
 * @param state - Current popup state
 */
export function resetPipelineAction(state: PopupState): void {
    state.stageStatus = {
        score: 'pending',
        rewrite: 'pending',
        analyze: 'pending',
    };
    state.stageResults = { score: null, rewrite: null, analyze: null };
    state.iterationCount = 0;
    state.hasUnsavedChanges = true;
    // Keep history for reference
}
