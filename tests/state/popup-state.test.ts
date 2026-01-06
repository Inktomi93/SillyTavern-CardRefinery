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
    abortGeneration,
    toggleHistory,
    getUserGuidance,
    setUserGuidance,
} from '../../src/state/popup-state';
import type { StageName } from '../../src/types';

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
});

describe('Generation Control', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        initState();
    });

    describe('abortGeneration', () => {
        it('aborts and clears generating state', () => {
            // Manually set up generating state for this test
            const state = getState();
            const controller = new AbortController();
            state.isGenerating = true;
            state.abortController = controller;

            abortGeneration();

            expect(getState().isGenerating).toBe(false);
            expect(getState().abortController).toBeNull();
            expect(controller.signal.aborted).toBe(true);
        });

        it('handles abort when not generating', () => {
            // Should not throw
            expect(() => abortGeneration()).not.toThrow();
        });
    });
});

describe('UI Toggle States', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        initState();
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
