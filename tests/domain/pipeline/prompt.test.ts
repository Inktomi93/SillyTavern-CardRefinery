/**
 * Pipeline Prompt Building Tests
 *
 * Tests for constructing user and system prompts for the pipeline stages.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock shared module
vi.mock('../../../src/shared', async () => {
    const actual = await vi.importActual('../../../src/shared');
    return {
        ...actual,
        log: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    };
});

import {
    buildUserPrompt,
    getInstructions,
    getSchema,
    getStageSystemPrompt,
} from '../../../src/domain/pipeline/prompt';
import type { StageConfig } from '../../../src/types';

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

/** Creates a previousResults object with all required keys (null by default) */
function createPreviousResults(
    overrides: {
        score?: {
            stage: 'score';
            timestamp: number;
            input: string;
            output: string;
        } | null;
        rewrite?: {
            stage: 'rewrite';
            timestamp: number;
            input: string;
            output: string;
        } | null;
        analyze?: {
            stage: 'analyze';
            timestamp: number;
            input: string;
            output: string;
        } | null;
    } = {},
) {
    return {
        score: overrides.score ?? null,
        rewrite: overrides.rewrite ?? null,
        analyze: overrides.analyze ?? null,
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
        mes_example: '',
    };
}

function createMockDeps() {
    return {
        getPromptPreset: vi.fn((id: string) => {
            if (id === 'preset-1') {
                return {
                    id: 'preset-1',
                    name: 'Test Preset',
                    prompt: 'Preset instructions here.',
                };
            }
            return null;
        }),
        getSchemaPreset: vi.fn((id: string) => {
            if (id === 'schema-1') {
                return {
                    id: 'schema-1',
                    name: 'Test Schema',
                    schema: { name: 'TestSchema', value: { type: 'object' } },
                };
            }
            return null;
        }),
        getSystemPrompt: vi.fn((stage: string) => `System prompt for ${stage}`),
        getRefinementPrompt: vi.fn(() => 'Refinement prompt'),
    };
}

// =============================================================================
// TESTS: getInstructions
// =============================================================================

describe('getInstructions', () => {
    it('returns custom prompt when provided', () => {
        const config = createMockConfig({
            customPrompt: 'My custom instructions.',
        });
        const deps = createMockDeps();

        const result = getInstructions(config, deps);

        expect(result).toBe('My custom instructions.');
        expect(deps.getPromptPreset).not.toHaveBeenCalled();
    });

    it('trims whitespace from custom prompt', () => {
        const config = createMockConfig({
            customPrompt: '  Trimmed instructions.  ',
        });
        const deps = createMockDeps();

        const result = getInstructions(config, deps);

        expect(result).toBe('Trimmed instructions.');
    });

    it('falls back to preset when no custom prompt', () => {
        const config = createMockConfig({ promptPresetId: 'preset-1' });
        const deps = createMockDeps();

        const result = getInstructions(config, deps);

        expect(result).toBe('Preset instructions here.');
        expect(deps.getPromptPreset).toHaveBeenCalledWith('preset-1');
    });

    it('returns empty string when no custom prompt and no valid preset', () => {
        const config = createMockConfig({ promptPresetId: 'nonexistent' });
        const deps = createMockDeps();

        const result = getInstructions(config, deps);

        expect(result).toBe('');
    });

    it('prefers custom prompt over preset', () => {
        const config = createMockConfig({
            customPrompt: 'Custom wins.',
            promptPresetId: 'preset-1',
        });
        const deps = createMockDeps();

        const result = getInstructions(config, deps);

        expect(result).toBe('Custom wins.');
        expect(deps.getPromptPreset).not.toHaveBeenCalled();
    });
});

// =============================================================================
// TESTS: getSchema
// =============================================================================

describe('getSchema', () => {
    it('returns null when structured output disabled', () => {
        const config = createMockConfig({ useStructuredOutput: false });
        const deps = createMockDeps();

        const result = getSchema(config, deps);

        expect(result).toBeNull();
    });

    it('parses and returns custom schema when provided', () => {
        const customSchema = JSON.stringify({
            name: 'CustomSchema',
            value: { type: 'object', properties: {} },
        });
        const config = createMockConfig({
            useStructuredOutput: true,
            customSchema,
        });
        const deps = createMockDeps();

        const result = getSchema(config, deps);

        expect(result).not.toBeNull();
        expect(result?.name).toBe('CustomSchema');
    });

    it('falls back to preset schema when no custom schema', () => {
        const config = createMockConfig({
            useStructuredOutput: true,
            schemaPresetId: 'schema-1',
        });
        const deps = createMockDeps();

        const result = getSchema(config, deps);

        expect(result).not.toBeNull();
        expect(result?.name).toBe('TestSchema');
    });

    it('returns null for invalid custom schema JSON', () => {
        const config = createMockConfig({
            useStructuredOutput: true,
            customSchema: '{ invalid json }',
        });
        const deps = createMockDeps();

        const result = getSchema(config, deps);

        expect(result).toBeNull();
    });
});

// =============================================================================
// TESTS: getStageSystemPrompt
// =============================================================================

describe('getStageSystemPrompt', () => {
    it('returns stage system prompt for non-refinement', () => {
        const deps = createMockDeps();

        const result = getStageSystemPrompt('score', false, deps);

        expect(deps.getSystemPrompt).toHaveBeenCalledWith('score');
        expect(result).toContain('score');
    });

    it('returns refinement prompt for refinement mode', () => {
        const deps = createMockDeps();

        const result = getStageSystemPrompt('rewrite', true, deps);

        expect(deps.getRefinementPrompt).toHaveBeenCalled();
        expect(result).toContain('Refinement');
    });
});

// =============================================================================
// TESTS: buildUserPrompt
// =============================================================================

describe('buildUserPrompt', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('includes character summary', () => {
        const ctx = {
            stage: 'score' as const,
            character: createMockCharacter(),
            selection: { description: true, personality: true },
            config: createMockConfig(),
            previousResults: createPreviousResults(),
            isRefinement: false,
            iterationCount: 0,
        };
        const deps = createMockDeps();

        const result = buildUserPrompt(ctx, deps);

        expect(result).toContain('Test Hero');
        expect(result).toContain('brave adventurer');
    });

    it('includes user guidance when provided', () => {
        const ctx = {
            stage: 'score' as const,
            character: createMockCharacter(),
            selection: { description: true },
            config: createMockConfig(),
            previousResults: createPreviousResults(),
            isRefinement: false,
            iterationCount: 0,
            guidance: 'Focus on making the character more mysterious.',
        };
        const deps = createMockDeps();

        const result = buildUserPrompt(ctx, deps);

        expect(result).toContain('USER GUIDANCE');
        expect(result).toContain('more mysterious');
    });

    it('excludes guidance section when guidance is empty', () => {
        const ctx = {
            stage: 'score' as const,
            character: createMockCharacter(),
            selection: { description: true },
            config: createMockConfig(),
            previousResults: createPreviousResults(),
            isRefinement: false,
            iterationCount: 0,
            guidance: '',
        };
        const deps = createMockDeps();

        const result = buildUserPrompt(ctx, deps);

        expect(result).not.toContain('USER GUIDANCE');
    });

    it('includes iteration info for refinements', () => {
        const ctx = {
            stage: 'rewrite' as const,
            character: createMockCharacter(),
            selection: { description: true },
            config: createMockConfig(),
            previousResults: createPreviousResults(),
            isRefinement: true,
            iterationCount: 2,
        };
        const deps = createMockDeps();

        const result = buildUserPrompt(ctx, deps);

        expect(result).toContain('iteration 3'); // 0-indexed + 1
    });

    it('includes instructions from config', () => {
        const ctx = {
            stage: 'score' as const,
            character: createMockCharacter(),
            selection: { description: true },
            config: createMockConfig({
                customPrompt: 'Rate on a scale of 1-10.',
            }),
            previousResults: createPreviousResults(),
            isRefinement: false,
            iterationCount: 0,
        };
        const deps = createMockDeps();

        const result = buildUserPrompt(ctx, deps);

        expect(result).toContain('INSTRUCTIONS');
        expect(result).toContain('Rate on a scale');
    });

    describe('rewrite stage', () => {
        it('includes score results for rewrite stage', () => {
            const ctx = {
                stage: 'rewrite' as const,
                character: createMockCharacter(),
                selection: { description: true },
                config: createMockConfig(),
                previousResults: createPreviousResults({
                    score: {
                        stage: 'score' as const,
                        timestamp: Date.now(),
                        input: '',
                        output: 'Score: 7/10. Needs more backstory.',
                    },
                }),
                isRefinement: false,
                iterationCount: 0,
            };
            const deps = createMockDeps();

            const result = buildUserPrompt(ctx, deps);

            expect(result).toContain('SCORE RESULTS');
            expect(result).toContain('7/10');
        });
    });

    describe('analyze stage', () => {
        it('includes original and rewritten versions for comparison', () => {
            const ctx = {
                stage: 'analyze' as const,
                character: createMockCharacter(),
                selection: { description: true },
                config: createMockConfig(),
                previousResults: createPreviousResults({
                    score: {
                        stage: 'score' as const,
                        timestamp: Date.now(),
                        input: '',
                        output: 'Initial score.',
                    },
                    rewrite: {
                        stage: 'rewrite' as const,
                        timestamp: Date.now(),
                        input: '',
                        output: 'Improved version of the character.',
                    },
                }),
                isRefinement: false,
                iterationCount: 0,
            };
            const deps = createMockDeps();

            const result = buildUserPrompt(ctx, deps);

            expect(result).toContain('ORIGINAL CHARACTER');
            expect(result).toContain('REWRITTEN VERSION');
            expect(result).toContain('Improved version');
        });
    });
});
