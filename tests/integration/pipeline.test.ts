/**
 * Pipeline Integration Tests
 *
 * End-to-end tests for the character refinement pipeline.
 * Tests the full flow: Score → Rewrite → Analyze
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

// Mock shared module
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
        toast: {
            success: vi.fn(),
            error: vi.fn(),
            warning: vi.fn(),
            info: vi.fn(),
        },
        isApiReady: vi.fn(() => true),
        getApiStatus: vi.fn(() => ({
            isReady: true,
            modelDisplay: 'gpt-4',
            statusText: 'Ready',
            error: null,
        })),
    };
});

// Mock generation module - use vi.hoisted for proper hoisting
const mockGenerate = vi.hoisted(() => vi.fn());
vi.mock('../../src/domain/generation', () => ({
    generate: mockGenerate,
}));

// Mock data module
vi.mock('../../src/data', () => ({
    getSettings: vi.fn(() => ({})),
    getStageDefaults: vi.fn(() => ({
        promptPresetId: null,
        customPrompt: '',
        schemaPresetId: null,
        customSchema: '',
        useStructuredOutput: false,
    })),
    save: vi.fn(),
}));

import {
    runStage,
    runPipeline,
    runRefinement,
} from '../../src/domain/pipeline/execution';
import type { StageConfig, StageName, StageResult } from '../../src/types';

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createMockConfig(overrides: Partial<StageConfig> = {}): StageConfig {
    return {
        promptPresetId: null,
        customPrompt: '',
        schemaPresetId: null,
        customSchema: '',
        useStructuredOutput: false,
        ...overrides,
    };
}

function createMockCharacter() {
    return {
        name: 'Test Hero',
        avatar: 'hero.png',
        description: 'A brave adventurer seeking glory.',
        personality: 'Bold, courageous, and kind.',
        first_mes: 'Greetings, traveler!',
        scenario: 'Fantasy world.',
    };
}

function createMockDeps() {
    return {
        getPromptPreset: vi.fn(() => null),
        getSchemaPreset: vi.fn(() => null),
        getSystemPrompt: vi.fn((stage: string) => `System prompt for ${stage}`),
        getRefinementPrompt: vi.fn(() => 'Refinement system prompt'),
    };
}

function createStageContext(stage: StageName, overrides = {}) {
    return {
        stage,
        character: createMockCharacter(),
        selection: { description: true, personality: true },
        config: createMockConfig(),
        previousResults: { score: null, rewrite: null, analyze: null },
        isRefinement: false,
        iterationCount: 0,
        guidance: '',
        ...overrides,
    };
}

function createPipelineContext(overrides = {}) {
    return {
        character: createMockCharacter(),
        selection: { description: true, personality: true },
        config: createMockConfig(),
        previousResults: {
            score: null as StageResult | null,
            rewrite: null as StageResult | null,
            analyze: null as StageResult | null,
        },
        isRefinement: false,
        iterationCount: 0,
        guidance: '',
        ...overrides,
    };
}

// =============================================================================
// TESTS: runStage
// =============================================================================

describe('runStage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGenerate.mockReset();
    });

    it('executes a stage and returns result', async () => {
        mockGenerate.mockResolvedValue({
            success: true,
            response: 'Score: 8/10\n\nThis character has a solid foundation.',
        });

        const ctx = createStageContext('score');
        const deps = createMockDeps();

        const result = await runStage(ctx, deps);

        expect(result.stage).toBe('score');
        expect(result.output).toContain('8/10');
        expect(result.error).toBeUndefined();
    });

    it('includes input prompt in result', async () => {
        mockGenerate.mockResolvedValue({
            success: true,
            response: 'Evaluation complete.',
        });

        const ctx = createStageContext('score');
        const deps = createMockDeps();

        const result = await runStage(ctx, deps);

        expect(result.input).toContain('Test Hero');
        expect(result.input).toContain('brave adventurer');
    });

    it('returns error result on generation failure', async () => {
        mockGenerate.mockResolvedValue({
            success: false,
            error: 'API rate limit exceeded',
        });

        const ctx = createStageContext('score');
        const deps = createMockDeps();

        const result = await runStage(ctx, deps);

        expect(result.error).toContain('rate limit');
        expect(result.output).toBe('');
    });

    it('handles abort signal', async () => {
        const controller = new AbortController();
        controller.abort();

        const ctx = createStageContext('score');
        const deps = createMockDeps();

        const result = await runStage(ctx, deps, { signal: controller.signal });

        expect(result.error).toContain('Aborted');
        expect(mockGenerate).not.toHaveBeenCalled();
    });

    it('calls progress callback', async () => {
        mockGenerate.mockResolvedValue({
            success: true,
            response: 'Done.',
        });

        const onProgress = vi.fn();
        const ctx = createStageContext('rewrite');
        const deps = createMockDeps();

        await runStage(ctx, deps, { onProgress });

        expect(onProgress).toHaveBeenCalledWith(
            expect.stringContaining('rewrite'),
        );
    });

    it('includes user guidance in prompt', async () => {
        mockGenerate.mockResolvedValue({
            success: true,
            response: 'Focused on backstory.',
        });

        const ctx = createStageContext('rewrite', {
            guidance: 'Focus more on backstory and motivation.',
        });
        const deps = createMockDeps();

        const result = await runStage(ctx, deps);

        expect(result.input).toContain('backstory');
        expect(result.guidance).toBe('Focus more on backstory and motivation.');
    });
});

// =============================================================================
// TESTS: runPipeline
// =============================================================================

describe('runPipeline', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGenerate.mockReset();
    });

    it('runs multiple stages in sequence', async () => {
        mockGenerate
            .mockResolvedValueOnce({
                success: true,
                response: 'Score: 7/10',
            })
            .mockResolvedValueOnce({
                success: true,
                response: 'Improved character description...',
            });

        const stages: StageName[] = ['score', 'rewrite'];
        const ctx = createPipelineContext();
        const deps = createMockDeps();

        const results = await runPipeline(stages, ctx, deps);

        expect(results.score).not.toBeNull();
        expect(results.rewrite).not.toBeNull();
        expect(results.score?.stage).toBe('score');
        expect(results.rewrite?.stage).toBe('rewrite');
        expect(mockGenerate).toHaveBeenCalledTimes(2);
    });

    it('passes previous results to subsequent stages', async () => {
        mockGenerate
            .mockResolvedValueOnce({
                success: true,
                response: 'Score: 6/10. Needs more depth.',
            })
            .mockResolvedValueOnce({
                success: true,
                response: 'Enhanced with more depth...',
            });

        const stages: StageName[] = ['score', 'rewrite'];
        const ctx = createPipelineContext();
        const deps = createMockDeps();

        const results = await runPipeline(stages, ctx, deps);

        // Second stage should have received score results
        const rewriteResult = results.rewrite;
        expect(rewriteResult?.input).toContain('SCORE RESULTS');
    });

    it('stops pipeline on abort', async () => {
        const controller = new AbortController();

        mockGenerate.mockImplementation(async () => {
            // Abort during first stage
            controller.abort();
            return { success: true, response: 'First result' };
        });

        const stages: StageName[] = ['score', 'rewrite', 'analyze'];
        const ctx = createPipelineContext();
        const deps = createMockDeps();

        const results = await runPipeline(stages, ctx, deps, {
            signal: controller.signal,
        });

        // Should have score result, but not all three
        expect(results.score).not.toBeNull();
        // Rewrite and analyze might be null due to abort
    });

    it('calls progress callback for each stage', async () => {
        mockGenerate.mockResolvedValue({
            success: true,
            response: 'Result',
        });

        const onProgress = vi.fn();
        const stages: StageName[] = ['score', 'rewrite'];
        const ctx = createPipelineContext();
        const deps = createMockDeps();

        await runPipeline(stages, ctx, deps, { onProgress });

        // Called twice per stage: once by runPipeline, once by runStage
        expect(onProgress).toHaveBeenCalledTimes(4);
    });
});

// =============================================================================
// TESTS: runRefinement
// =============================================================================

describe('runRefinement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGenerate.mockReset();
    });

    it('runs refinement on rewrite stage', async () => {
        mockGenerate.mockResolvedValue({
            success: true,
            response: 'Refined output.',
        });

        const ctx = createPipelineContext({
            iterationCount: 1,
            guidance: 'Improve the description.',
        });
        const deps = createMockDeps();

        const result = await runRefinement(ctx, deps);

        expect(result.stage).toBe('rewrite');
        expect(result.output).toBe('Refined output.');
        expect(deps.getRefinementPrompt).toHaveBeenCalled();
    });

    it('includes iteration info in prompt', async () => {
        mockGenerate.mockResolvedValue({
            success: true,
            response: 'Iteration result.',
        });

        const ctx = createPipelineContext({
            iterationCount: 2,
        });
        const deps = createMockDeps();

        const result = await runRefinement(ctx, deps);

        // iterationCount + 1 in display
        expect(result.input).toContain('iteration 3');
    });
});

// =============================================================================
// TESTS: Error Handling
// =============================================================================

describe('Pipeline Error Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGenerate.mockReset();
    });

    it('stops pipeline on stage error', async () => {
        mockGenerate
            .mockResolvedValueOnce({
                success: false,
                error: 'First stage failed',
            })
            .mockResolvedValueOnce({
                success: true,
                response: 'Second stage succeeded',
            });

        const stages: StageName[] = ['score', 'rewrite'];
        const ctx = createPipelineContext();
        const deps = createMockDeps();

        const results = await runPipeline(stages, ctx, deps);

        expect(results.score?.error).toBeDefined();
        // Pipeline stops on error, so rewrite doesn't run
        expect(results.rewrite).toBeNull();
    });
});

// =============================================================================
// TESTS: Full Pipeline Flow
// =============================================================================

describe('Full Pipeline Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGenerate.mockReset();
    });

    it('completes full refinement cycle', async () => {
        mockGenerate
            .mockResolvedValueOnce({
                success: true,
                response:
                    'Initial Score: 6/10\n\nNeeds more depth in backstory.',
            })
            .mockResolvedValueOnce({
                success: true,
                response:
                    '## Enhanced Description\n\nA weathered warrior with a mysterious past...',
            })
            .mockResolvedValueOnce({
                success: true,
                response:
                    '## Analysis\n\nThe rewrite successfully addresses the backstory concerns.',
            });

        const stages: StageName[] = ['score', 'rewrite', 'analyze'];
        const ctx = createPipelineContext();
        const deps = createMockDeps();

        const results = await runPipeline(stages, ctx, deps);

        // Score stage
        expect(results.score?.stage).toBe('score');
        expect(results.score?.output).toContain('6/10');

        // Rewrite stage
        expect(results.rewrite?.stage).toBe('rewrite');
        expect(results.rewrite?.output).toContain('Enhanced Description');

        // Analyze stage
        expect(results.analyze?.stage).toBe('analyze');
        expect(results.analyze?.output).toContain('Analysis');

        // Analyze should have access to both previous results
        expect(results.analyze?.input).toContain('ORIGINAL CHARACTER');
        expect(results.analyze?.input).toContain('REWRITTEN VERSION');
    });

    it('supports iterative refinement workflow', async () => {
        mockGenerate.mockResolvedValue({
            success: true,
            response: 'Iteration result',
        });

        const deps = createMockDeps();

        // Simulate multiple refinement iterations
        let previousResults: Record<StageName, StageResult | null> = {
            score: null,
            rewrite: null,
            analyze: null,
        };

        for (let i = 0; i < 3; i++) {
            const ctx = createPipelineContext({
                iterationCount: i,
                previousResults,
            });

            const result = await runRefinement(ctx, deps);

            previousResults = {
                ...previousResults,
                rewrite: result,
            };

            expect(result.stage).toBe('rewrite');
        }

        expect(mockGenerate).toHaveBeenCalledTimes(3);
    });
});
