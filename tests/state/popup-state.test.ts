/**
 * Popup State Management Tests
 *
 * Tests for the runtime state management of the CardRefinery popup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    };
});

// Mock data module
vi.mock('../../src/data', () => ({
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
    getStageDefaults: vi.fn((stage: string) => ({
        promptPresetId: null,
        customPrompt: '',
        schemaPresetId: null,
        customSchema: '',
        useStructuredOutput: false,
    })),
    save: vi.fn(),
    saveSession: vi.fn(),
}));

import {
    createInitialState,
    initState,
    clearState,
    getState,
    getStateOrNull,
    setActiveStage,
    toggleField,
    setFieldSelection,
    setStageStatus,
    recordStageResult,
    incrementIteration,
    resetPipeline,
    setGenerating,
    abortGeneration,
    setSearchState,
    toggleSessionList,
    toggleHistory,
    getUserGuidance,
    setUserGuidance,
} from '../../src/state/popup-state';
import type { StageName, StageResult } from '../../src/types';

// =============================================================================
// TESTS
// =============================================================================

describe('State Initialization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearState();
    });

    describe('createInitialState', () => {
        it('creates state with null character', () => {
            const state = createInitialState();
            expect(state.character).toBeNull();
        });

        it('creates state with empty field selections', () => {
            const state = createInitialState();
            expect(state.selectedFields).toEqual({});
            expect(state.stageFields.base).toEqual({});
        });

        it('creates state with linked stage fields', () => {
            const state = createInitialState();
            expect(state.stageFields.linked).toBe(true);
        });

        it('creates state with pending stage statuses', () => {
            const state = createInitialState();
            expect(state.stageStatus.score).toBe('pending');
            expect(state.stageStatus.rewrite).toBe('pending');
            expect(state.stageStatus.analyze).toBe('pending');
        });

        it('creates state with null stage results', () => {
            const state = createInitialState();
            expect(state.stageResults.score).toBeNull();
            expect(state.stageResults.rewrite).toBeNull();
            expect(state.stageResults.analyze).toBeNull();
        });

        it('creates state with score as active stage', () => {
            const state = createInitialState();
            expect(state.activeStage).toBe('score');
        });

        it('creates state with zero iteration count', () => {
            const state = createInitialState();
            expect(state.iterationCount).toBe(0);
            expect(state.iterationHistory).toEqual([]);
        });

        it('creates state not generating', () => {
            const state = createInitialState();
            expect(state.isGenerating).toBe(false);
            expect(state.abortController).toBeNull();
        });

        it('creates state with empty search', () => {
            const state = createInitialState();
            expect(state.searchQuery).toBe('');
            expect(state.searchResults).toEqual([]);
            expect(state.searchSelectedIndex).toBe(-1);
            expect(state.dropdownOpen).toBe(false);
        });
    });

    describe('initState', () => {
        it('initializes and returns state', () => {
            const state = initState();
            expect(state).toBeDefined();
            expect(state.character).toBeNull();
        });

        it('makes state accessible via getState', () => {
            const state = initState();
            const retrieved = getState();
            expect(retrieved).toBe(state);
        });
    });

    describe('getState / getStateOrNull', () => {
        it('getState throws when not initialized', () => {
            expect(() => getState()).toThrow();
        });

        it('getStateOrNull returns null when not initialized', () => {
            expect(getStateOrNull()).toBeNull();
        });

        it('getStateOrNull returns state when initialized', () => {
            initState();
            expect(getStateOrNull()).not.toBeNull();
        });
    });

    describe('clearState', () => {
        it('clears initialized state', () => {
            initState();
            expect(getStateOrNull()).not.toBeNull();

            clearState();
            expect(getStateOrNull()).toBeNull();
        });
    });
});

describe('Stage Management', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        initState();
    });

    describe('setActiveStage', () => {
        it('changes active stage', () => {
            setActiveStage('rewrite');
            expect(getState().activeStage).toBe('rewrite');
        });

        it('can set any valid stage', () => {
            const stages: StageName[] = ['score', 'rewrite', 'analyze'];
            for (const stage of stages) {
                setActiveStage(stage);
                expect(getState().activeStage).toBe(stage);
            }
        });
    });

    describe('setStageStatus', () => {
        it('updates stage status', () => {
            setStageStatus('score', 'running');
            expect(getState().stageStatus.score).toBe('running');
        });

        it('can set complete status', () => {
            setStageStatus('rewrite', 'complete');
            expect(getState().stageStatus.rewrite).toBe('complete');
        });

        it('can set error status', () => {
            setStageStatus('analyze', 'error');
            expect(getState().stageStatus.analyze).toBe('error');
        });
    });

    describe('recordStageResult', () => {
        it('stores stage result', () => {
            const result: StageResult = {
                stage: 'score',
                timestamp: Date.now(),
                input: 'test input',
                output: 'Score: 8/10',
            };

            recordStageResult(result);

            expect(getState().stageResults.score).toEqual(result);
        });

        it('adds result to iteration history', () => {
            const result: StageResult = {
                stage: 'score',
                timestamp: Date.now(),
                input: 'test input',
                output: 'Score: 8/10',
            };

            recordStageResult(result);

            expect(getState().iterationHistory).toContain(result);
        });

        it('marks stage as complete for successful result', () => {
            const result: StageResult = {
                stage: 'score',
                timestamp: Date.now(),
                input: 'test',
                output: 'Success',
            };

            recordStageResult(result);

            expect(getState().stageStatus.score).toBe('complete');
        });

        it('marks stage as error for failed result', () => {
            const result: StageResult = {
                stage: 'score',
                timestamp: Date.now(),
                input: 'test',
                output: '',
                error: 'Generation failed',
            };

            recordStageResult(result);

            expect(getState().stageStatus.score).toBe('error');
        });
    });
});

describe('Field Selection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        initState();
    });

    describe('toggleField', () => {
        it('adds field when toggled on', () => {
            toggleField('description', true);

            const state = getState();
            expect(state.stageFields.base.description).toBe(true);
        });

        it('removes field when toggled off', () => {
            // First add it
            toggleField('description', true);
            // Then remove it
            toggleField('description', false);

            const state = getState();
            expect(state.stageFields.base.description).toBeUndefined();
        });

        it('handles array values for alternate greetings', () => {
            toggleField('alternate_greetings', [0, 2, 3]);

            const state = getState();
            expect(state.stageFields.base.alternate_greetings).toEqual([
                0, 2, 3,
            ]);
        });

        it('removes array field when empty array', () => {
            toggleField('alternate_greetings', [0, 1]);
            toggleField('alternate_greetings', []);

            const state = getState();
            expect(state.stageFields.base.alternate_greetings).toBeUndefined();
        });

        it('syncs with legacy selectedFields', () => {
            toggleField('personality', true);

            const state = getState();
            expect(state.selectedFields.personality).toBe(true);
        });
    });

    describe('setFieldSelection', () => {
        it('replaces entire field selection', () => {
            // Set initial fields
            toggleField('description', true);

            // Replace with new selection
            setFieldSelection({ personality: true, scenario: true });

            const state = getState();
            expect(state.stageFields.base).toEqual({
                personality: true,
                scenario: true,
            });
            expect(state.stageFields.base.description).toBeUndefined();
        });
    });
});

describe('Iteration Management', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        initState();
    });

    describe('incrementIteration', () => {
        it('increments iteration count', () => {
            expect(getState().iterationCount).toBe(0);

            incrementIteration();
            expect(getState().iterationCount).toBe(1);

            incrementIteration();
            expect(getState().iterationCount).toBe(2);
        });
    });

    describe('resetPipeline', () => {
        it('resets stage statuses to pending', () => {
            setStageStatus('score', 'complete');
            setStageStatus('rewrite', 'running');

            resetPipeline();

            const state = getState();
            expect(state.stageStatus.score).toBe('pending');
            expect(state.stageStatus.rewrite).toBe('pending');
            expect(state.stageStatus.analyze).toBe('pending');
        });

        it('clears stage results', () => {
            recordStageResult({
                stage: 'score',
                timestamp: Date.now(),
                input: 'test',
                output: 'result',
            });

            resetPipeline();

            const state = getState();
            expect(state.stageResults.score).toBeNull();
            expect(state.stageResults.rewrite).toBeNull();
            expect(state.stageResults.analyze).toBeNull();
        });

        it('resets iteration count and guidance', () => {
            incrementIteration();
            incrementIteration();
            setUserGuidance('Some guidance');

            resetPipeline();

            expect(getState().iterationCount).toBe(0);
            expect(getState().userGuidance).toBe('');
        });
    });
});

describe('Generation Control', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        initState();
    });

    describe('setGenerating', () => {
        it('sets generating state and creates abort controller', () => {
            setGenerating(true);

            const state = getState();
            expect(state.isGenerating).toBe(true);
            expect(state.abortController).not.toBeNull();
        });

        it('clears abort controller when stopping', () => {
            setGenerating(true);
            setGenerating(false);

            const state = getState();
            expect(state.isGenerating).toBe(false);
            expect(state.abortController).toBeNull();
        });
    });

    describe('abortGeneration', () => {
        it('aborts and clears generating state', () => {
            setGenerating(true);
            const controller = getState().abortController;

            abortGeneration();

            expect(getState().isGenerating).toBe(false);
            expect(getState().abortController).toBeNull();
            expect(controller?.signal.aborted).toBe(true);
        });

        it('handles abort when not generating', () => {
            // Should not throw
            expect(() => abortGeneration()).not.toThrow();
        });
    });
});

describe('Search State', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        initState();
    });

    describe('setSearchState', () => {
        it('updates search query', () => {
            setSearchState({ query: 'test search' });

            expect(getState().searchQuery).toBe('test search');
        });

        it('updates search results', () => {
            const mockResults = [
                { name: 'Char 1', avatar: 'char1.png' },
                { name: 'Char 2', avatar: 'char2.png' },
            ];
            setSearchState({ results: mockResults });

            expect(getState().searchResults).toEqual(mockResults);
        });

        it('updates selected index', () => {
            setSearchState({ selectedIndex: 2 });

            expect(getState().searchSelectedIndex).toBe(2);
        });

        it('updates dropdown open state', () => {
            setSearchState({ dropdownOpen: true });

            expect(getState().dropdownOpen).toBe(true);
        });

        it('can update multiple properties at once', () => {
            setSearchState({
                query: 'multi',
                selectedIndex: 1,
                dropdownOpen: true,
            });

            const state = getState();
            expect(state.searchQuery).toBe('multi');
            expect(state.searchSelectedIndex).toBe(1);
            expect(state.dropdownOpen).toBe(true);
        });
    });
});

describe('UI Toggle States', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        initState();
    });

    describe('toggleSessionList', () => {
        it('toggles session list expanded state', () => {
            expect(getState().sessionListExpanded).toBe(false);

            toggleSessionList();
            expect(getState().sessionListExpanded).toBe(true);

            toggleSessionList();
            expect(getState().sessionListExpanded).toBe(false);
        });
    });

    describe('toggleHistory', () => {
        it('toggles history expanded state', () => {
            expect(getState().historyExpanded).toBe(false); // Default is collapsed

            toggleHistory();
            expect(getState().historyExpanded).toBe(true);

            toggleHistory();
            expect(getState().historyExpanded).toBe(false);
        });
    });
});

describe('User Guidance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        initState();
    });

    describe('getUserGuidance / setUserGuidance', () => {
        it('gets empty guidance by default', () => {
            expect(getUserGuidance()).toBe('');
        });

        it('sets and retrieves user guidance', () => {
            setUserGuidance('Focus on backstory.');

            expect(getUserGuidance()).toBe('Focus on backstory.');
            expect(getState().userGuidance).toBe('Focus on backstory.');
        });

        it('can update guidance multiple times', () => {
            setUserGuidance('First guidance');
            setUserGuidance('Updated guidance');

            expect(getUserGuidance()).toBe('Updated guidance');
        });
    });
});
