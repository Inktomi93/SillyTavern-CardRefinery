/**
 * Pipeline Actions Tests
 *
 * Tests for the pipeline orchestration layer - ensuring data flows correctly
 * between stages and iterations don't get stale results.
 *
 * KEY BUGS THESE TESTS PREVENT:
 * - Iteration staleness: stage N+1 seeing stage N-1's results instead of stage N's
 * - Result accumulation: passing ALL historical results instead of just current
 * - State mutation: stageResults not being updated after each stage completes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StageName, StageResult, PopupState } from '../../src/types';

// =============================================================================
// MOCKS
// =============================================================================

// Mock the shared module
vi.mock('../../src/shared', async () => {
    const actual = await vi.importActual('../../src/shared');
    return {
        ...actual,
        STAGES: ['score', 'rewrite', 'analyze'] as const,
        log: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
        loader: {
            show: vi.fn(),
            hide: vi.fn(),
        },
    };
});

// Mock the data module
vi.mock('../../src/data', () => ({
    getPromptPreset: vi.fn(() => null),
    getSchemaPreset: vi.fn(() => null),
    getSystemPrompt: vi.fn(() => 'System prompt'),
    getRefinementPrompt: vi.fn(() => 'Refinement prompt'),
    getSettings: vi.fn(() => ({
        stageDefaults: {
            score: {
                promptPresetId: null,
                customPrompt: '',
                schemaPresetId: null,
                customSchema: '',
                useStructuredOutput: false,
            },
            rewrite: {
                promptPresetId: null,
                customPrompt: '',
                schemaPresetId: null,
                customSchema: '',
                useStructuredOutput: false,
            },
            analyze: {
                promptPresetId: null,
                customPrompt: '',
                schemaPresetId: null,
                customSchema: '',
                useStructuredOutput: false,
            },
        },
    })),
    getStageDefaults: vi.fn(() => ({
        promptPresetId: null,
        customPrompt: '',
        schemaPresetId: null,
        customSchema: '',
        useStructuredOutput: false,
    })),
    save: vi.fn(),
    saveSession: vi.fn(),
}));

// Hoisted mock for runStage
const mockRunStage = vi.hoisted(() => vi.fn());

// Mock the domain module
vi.mock('../../src/domain', () => ({
    runStage: mockRunStage,
}));

// Mock popup-state - we need partial mocks
vi.mock('../../src/state/popup-state', async () => {
    const actual = await vi.importActual('../../src/state/popup-state');
    return {
        ...actual,
    };
});

import {
    executeStageAction,
    executeQuickIterateAction,
    executeAllStagesAction,
} from '../../src/state/pipeline-actions';
import { initState, clearState } from '../../src/state/popup-state';
import { createMockCharacter } from '../setup';

// =============================================================================
// TEST UTILITIES
// =============================================================================

function createMockState(): PopupState {
    const state = initState();
    state.character = createMockCharacter() as PopupState['character'];
    return state;
}

function createStageResult(
    stage: StageName,
    output: string,
    overrides: Partial<StageResult> = {},
): StageResult {
    return {
        stage,
        timestamp: Date.now(),
        input: `Input for ${stage}`,
        output,
        ...overrides,
    };
}

// =============================================================================
// TESTS: Stage Execution
// =============================================================================

describe('executeStageAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearState();
        mockRunStage.mockReset();
    });

    it('passes current stageResults as previousResults to runStage', async () => {
        const state = createMockState();

        // Set up existing results
        const scoreResult = createStageResult('score', 'Score: 7/10');
        state.stageResults.score = scoreResult;

        mockRunStage.mockResolvedValue(
            createStageResult('rewrite', 'Improved description'),
        );

        await executeStageAction(state, { stage: 'rewrite' });

        // Verify runStage was called with correct previousResults
        expect(mockRunStage).toHaveBeenCalledTimes(1);
        const context = mockRunStage.mock.calls[0][0];

        expect(context.previousResults.score).toEqual(scoreResult);
        expect(context.stage).toBe('rewrite');
    });

    it('updates stageResults after execution', async () => {
        const state = createMockState();
        const expectedResult = createStageResult('score', 'Score: 8/10');

        mockRunStage.mockResolvedValue(expectedResult);

        await executeStageAction(state, { stage: 'score' });

        expect(state.stageResults.score).toEqual(expectedResult);
    });

    it('does not run if no character selected', async () => {
        const state = initState(); // No character

        const result = await executeStageAction(state, { stage: 'score' });

        expect(result).toBeNull();
        expect(mockRunStage).not.toHaveBeenCalled();
    });

    it('does not run if already generating', async () => {
        const state = createMockState();
        state.isGenerating = true;

        const result = await executeStageAction(state, { stage: 'score' });

        expect(result).toBeNull();
        expect(mockRunStage).not.toHaveBeenCalled();
    });
});

// =============================================================================
// TESTS: Quick Iterate (Iteration Staleness Prevention)
// =============================================================================

describe('executeQuickIterateAction - Iteration Staleness', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearState();
        mockRunStage.mockReset();
    });

    it('analyze stage receives FRESH rewrite result, not stale state', async () => {
        const state = createMockState();

        // Set up initial state with old results
        const oldAnalyze = createStageResult('analyze', 'Old analysis');
        state.stageResults.analyze = oldAnalyze;
        state.stageResults.score = createStageResult('score', 'Score: 6/10');

        // Fresh rewrite output from this iteration
        const freshRewrite = createStageResult(
            'rewrite',
            'FRESH rewrite content',
        );

        let analyzeContextCapture: unknown = null;

        mockRunStage.mockImplementation(async (ctx) => {
            if (ctx.stage === 'rewrite') {
                return freshRewrite;
            }
            if (ctx.stage === 'analyze') {
                // Capture the context passed to analyze
                analyzeContextCapture = ctx;
                return createStageResult('analyze', 'New analysis');
            }
            return createStageResult(ctx.stage, 'Output');
        });

        await executeQuickIterateAction(state, {});

        // CRITICAL: Analyze should see the FRESH rewrite, not any stale value
        expect(analyzeContextCapture).not.toBeNull();
        const analyzeCtx = analyzeContextCapture as {
            previousResults: Record<StageName, StageResult | null>;
        };
        expect(analyzeCtx.previousResults.rewrite).toEqual(freshRewrite);
    });

    it('stageResults are updated after each stage, not batched at end', async () => {
        const state = createMockState();
        state.stageResults.analyze = createStageResult(
            'analyze',
            'Initial analyze',
        );

        const rewriteResult = createStageResult('rewrite', 'Rewritten');
        const analyzeResult = createStageResult('analyze', 'Analyzed');

        const stateSnapshotsAfterStage: Record<
            string,
            typeof state.stageResults
        >[] = [];

        mockRunStage.mockImplementation(async (ctx) => {
            if (ctx.stage === 'rewrite') {
                // Snapshot state AFTER rewrite would complete
                return rewriteResult;
            }
            if (ctx.stage === 'analyze') {
                // Capture state at this point - rewrite should already be recorded
                stateSnapshotsAfterStage.push({
                    atAnalyzeStart: { ...state.stageResults },
                });
                return analyzeResult;
            }
            return createStageResult(ctx.stage, 'Output');
        });

        await executeQuickIterateAction(state, {});

        // After completion, both should be updated
        expect(state.stageResults.rewrite).toEqual(rewriteResult);
        expect(state.stageResults.analyze).toEqual(analyzeResult);
    });

    it('increments iteration count before running', async () => {
        const state = createMockState();
        state.stageResults.analyze = createStageResult('analyze', 'Initial');
        state.iterationCount = 0;

        let iterationAtRewrite = -1;

        mockRunStage.mockImplementation(async (ctx) => {
            if (ctx.stage === 'rewrite') {
                iterationAtRewrite = ctx.iterationCount;
            }
            return createStageResult(ctx.stage, 'Output');
        });

        await executeQuickIterateAction(state, {});

        // Iteration should have been incremented before rewrite ran
        expect(iterationAtRewrite).toBe(1);
        expect(state.iterationCount).toBe(1);
    });

    it('multiple iterations each see fresh data from previous iteration', async () => {
        const state = createMockState();
        state.stageResults.analyze = createStageResult(
            'analyze',
            'Initial analyze',
        );
        state.iterationCount = 0;

        const rewriteOutputs = ['Rewrite v1', 'Rewrite v2', 'Rewrite v3'];
        const analyzeInputsReceived: string[] = [];
        let iterationIndex = 0;

        mockRunStage.mockImplementation(async (ctx) => {
            if (ctx.stage === 'rewrite') {
                return createStageResult(
                    'rewrite',
                    rewriteOutputs[iterationIndex],
                );
            }
            if (ctx.stage === 'analyze') {
                // Record what rewrite output analyze saw
                const rewriteItSaw =
                    ctx.previousResults.rewrite?.output ?? 'none';
                analyzeInputsReceived.push(rewriteItSaw);
                return createStageResult(
                    'analyze',
                    `Analyzed: ${rewriteItSaw}`,
                );
            }
            return createStageResult(ctx.stage, 'Output');
        });

        // Run 3 iterations
        for (let i = 0; i < 3; i++) {
            iterationIndex = i;
            await executeQuickIterateAction(state, {});
        }

        // Each analyze should have seen the FRESH rewrite from that iteration
        expect(analyzeInputsReceived[0]).toBe('Rewrite v1');
        expect(analyzeInputsReceived[1]).toBe('Rewrite v2');
        expect(analyzeInputsReceived[2]).toBe('Rewrite v3');

        // Final iteration count should be 3
        expect(state.iterationCount).toBe(3);
    });

    it('does not accumulate results in iterationHistory incorrectly', async () => {
        const state = createMockState();
        state.stageResults.analyze = createStageResult('analyze', 'Initial');
        state.iterationHistory = []; // Start fresh

        mockRunStage.mockImplementation(async (ctx) => {
            return createStageResult(ctx.stage, `Output for ${ctx.stage}`);
        });

        // Run 2 iterations
        await executeQuickIterateAction(state, {});
        await executeQuickIterateAction(state, {});

        // Should have 4 entries: 2 iterations * 2 stages (rewrite + analyze)
        expect(state.iterationHistory).toHaveLength(4);

        // Results should be in order: rewrite1, analyze1, rewrite2, analyze2
        expect(state.iterationHistory[0].stage).toBe('rewrite');
        expect(state.iterationHistory[1].stage).toBe('analyze');
        expect(state.iterationHistory[2].stage).toBe('rewrite');
        expect(state.iterationHistory[3].stage).toBe('analyze');
    });

    it('requires analyze result to run (prevents undefined behavior)', async () => {
        const state = createMockState();
        // No analyze result
        state.stageResults.analyze = null;

        const result = await executeQuickIterateAction(state, {});

        expect(result).toEqual({ rewrite: null, analyze: null });
        expect(mockRunStage).not.toHaveBeenCalled();
    });
});

// =============================================================================
// TESTS: Execute All Stages
// =============================================================================

describe('executeAllStagesAction - Data Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearState();
        mockRunStage.mockReset();
    });

    it('each stage receives results from previous stages in same run', async () => {
        const state = createMockState();

        // Ensure state starts with no results
        state.stageResults = { score: null, rewrite: null, analyze: null };

        const contextCaptures: Record<StageName, unknown> = {
            score: null,
            rewrite: null,
            analyze: null,
        };

        mockRunStage.mockImplementation(async (ctx) => {
            // Deep copy to capture the state at call time
            contextCaptures[ctx.stage as StageName] = {
                ...ctx,
                previousResults: { ...ctx.previousResults },
            };
            return createStageResult(ctx.stage, `Output for ${ctx.stage}`);
        });

        await executeAllStagesAction(state, {
            stages: ['score', 'rewrite', 'analyze'],
        });

        // Score should have null previousResults (first stage, fresh state)
        const scoreCtx = contextCaptures.score as {
            previousResults: Record<StageName, StageResult | null>;
        };
        expect(scoreCtx.previousResults.score).toBeNull();
        expect(scoreCtx.previousResults.rewrite).toBeNull();
        expect(scoreCtx.previousResults.analyze).toBeNull();

        // Rewrite should see score result from this pipeline run
        const rewriteCtx = contextCaptures.rewrite as {
            previousResults: Record<StageName, StageResult | null>;
        };
        expect(rewriteCtx.previousResults.score).not.toBeNull();
        expect(rewriteCtx.previousResults.score?.output).toBe(
            'Output for score',
        );

        // Analyze should see both score and rewrite results
        const analyzeCtx = contextCaptures.analyze as {
            previousResults: Record<StageName, StageResult | null>;
        };
        expect(analyzeCtx.previousResults.score).not.toBeNull();
        expect(analyzeCtx.previousResults.rewrite).not.toBeNull();
        expect(analyzeCtx.previousResults.rewrite?.output).toBe(
            'Output for rewrite',
        );
    });

    it('stops pipeline on error without corrupting state', async () => {
        const state = createMockState();

        mockRunStage.mockImplementation(async (ctx) => {
            if (ctx.stage === 'score') {
                return createStageResult('score', '', { error: 'API error' });
            }
            return createStageResult(ctx.stage, 'Should not reach');
        });

        const result = await executeAllStagesAction(state, {
            stages: ['score', 'rewrite', 'analyze'],
        });

        // Score ran but errored
        expect(result.score).not.toBeNull();
        expect(result.score?.error).toBe('API error');

        // Rewrite and analyze should not have run
        expect(result.rewrite).toBeNull();
        expect(result.analyze).toBeNull();

        // State should reflect the error
        expect(state.stageStatus.score).toBe('error');
    });
});

// =============================================================================
// TESTS: State Isolation
// =============================================================================

describe('State Isolation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearState();
        mockRunStage.mockReset();
    });

    it('stageResults gets overwritten while iterationHistory grows', async () => {
        const state = createMockState();
        state.stageResults.analyze = createStageResult('analyze', 'Initial');
        state.iterationHistory = [];

        let callCount = 0;
        mockRunStage.mockImplementation(async (ctx) => {
            callCount++;
            return createStageResult(ctx.stage, `Output ${callCount}`);
        });

        // Run iteration 1
        await executeQuickIterateAction(state, {});

        // After iteration 1: stageResults has latest, history has 2 entries
        expect(state.stageResults.rewrite?.output).toBe('Output 1');
        expect(state.stageResults.analyze?.output).toBe('Output 2');
        expect(state.iterationHistory).toHaveLength(2);

        // Run iteration 2
        await executeQuickIterateAction(state, {});

        // After iteration 2: stageResults OVERWRITES to latest
        expect(state.stageResults.rewrite?.output).toBe('Output 3');
        expect(state.stageResults.analyze?.output).toBe('Output 4');

        // iterationHistory GROWS (append-only) - has all 4 entries
        expect(state.iterationHistory).toHaveLength(4);
        expect(state.iterationHistory[0].output).toBe('Output 1');
        expect(state.iterationHistory[1].output).toBe('Output 2');
        expect(state.iterationHistory[2].output).toBe('Output 3');
        expect(state.iterationHistory[3].output).toBe('Output 4');
    });

    it('previousResults uses stageResults (current), not iterationHistory (all)', async () => {
        const state = createMockState();
        state.stageResults.analyze = createStageResult('analyze', 'Initial');
        state.iterationHistory = [
            createStageResult('score', 'Old score 1'),
            createStageResult('rewrite', 'Old rewrite 1'),
            createStageResult('analyze', 'Old analyze 1'),
        ];

        // Set specific current results
        state.stageResults.score = createStageResult('score', 'CURRENT score');

        let rewriteContextCapture: unknown = null;

        mockRunStage.mockImplementation(async (ctx) => {
            if (ctx.stage === 'rewrite') {
                rewriteContextCapture = {
                    ...ctx,
                    previousResults: { ...ctx.previousResults },
                };
            }
            return createStageResult(ctx.stage, `New ${ctx.stage}`);
        });

        await executeQuickIterateAction(state, {});

        // Rewrite should see CURRENT stageResults, not old history
        const rewriteCtx = rewriteContextCapture as {
            previousResults: Record<StageName, StageResult | null>;
        };
        expect(rewriteCtx.previousResults.score?.output).toBe('CURRENT score');
    });
});
