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

import { runStage } from '../../src/domain/pipeline/execution';
import type { StageConfig, StageName } from '../../src/types';

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
