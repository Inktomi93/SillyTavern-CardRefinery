/**
 * Observable Store Tests
 *
 * Tests for the centralized state management store with slice-based
 * subscriptions and microtask batching.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock shared module before imports
vi.mock('../../src/shared', () => ({
    log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock data module
vi.mock('../../src/data/settings', () => ({
    getStageDefaults: vi.fn((stage: string) => ({
        promptPresetId: null,
        customPrompt: '',
        schemaPresetId: null,
        customSchema: '',
        useStructuredOutput: false,
    })),
}));

import {
    getState,
    getStateOrNull,
    setState,
    batch,
    subscribe,
    initStore,
    resetStore,
    createInitialState,
} from '../../src/state/store';
import { log } from '../../src/shared';
import type { StateSlice } from '../../src/types/store';

// =============================================================================
// TESTS
// =============================================================================

describe('Store', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Ensure clean state for each test
        resetStore();
    });

    afterEach(() => {
        resetStore();
    });

    // -------------------------------------------------------------------------
    // State Access
    // -------------------------------------------------------------------------

    describe('State Access', () => {
        describe('getState', () => {
            it('throws when store not initialized', () => {
                expect(() => getState()).toThrow(
                    '[Store] Not initialized. Call init() before accessing state.',
                );
            });

            it('returns state when initialized', () => {
                initStore();
                const state = getState();
                expect(state).toBeDefined();
                expect(state.character).toBeNull();
            });

            it('returns readonly state', () => {
                initStore();
                const state = getState();
                // TypeScript would prevent this, but we can verify the object is returned
                expect(state).toHaveProperty('character');
            });
        });

        describe('getStateOrNull', () => {
            it('returns null when not initialized', () => {
                expect(getStateOrNull()).toBeNull();
            });

            it('returns state when initialized', () => {
                initStore();
                expect(getStateOrNull()).not.toBeNull();
                expect(getStateOrNull()?.character).toBeNull();
            });
        });
    });

    // -------------------------------------------------------------------------
    // State Mutations
    // -------------------------------------------------------------------------

    describe('State Mutations', () => {
        beforeEach(() => {
            initStore();
        });

        describe('setState with direct updates', () => {
            it('applies partial state updates', async () => {
                setState('ui', { historyExpanded: true });
                // Wait for microtask to flush
                await Promise.resolve();

                expect(getState().historyExpanded).toBe(true);
            });

            it('preserves other state properties', async () => {
                const initialCharacter = getState().character;
                setState('ui', { historyExpanded: true });
                await Promise.resolve();

                expect(getState().character).toBe(initialCharacter);
                expect(getState().activeStage).toBe('score');
            });

            it('handles multiple properties in single update', async () => {
                setState('search', {
                    searchQuery: 'test',
                    searchSelectedIndex: 5,
                });
                await Promise.resolve();

                expect(getState().searchQuery).toBe('test');
                expect(getState().searchSelectedIndex).toBe(5);
            });
        });

        describe('setState with updater function', () => {
            it('receives current state', async () => {
                setState('results', { iterationCount: 5 });
                await Promise.resolve();

                setState('results', (state) => ({
                    iterationCount: state.iterationCount + 1,
                }));
                await Promise.resolve();

                expect(getState().iterationCount).toBe(6);
            });

            it('can compute derived updates', async () => {
                setState('guidance', { userGuidance: 'Hello' });
                await Promise.resolve();

                setState('guidance', (state) => ({
                    userGuidance: state.userGuidance + ' World',
                }));
                await Promise.resolve();

                expect(getState().userGuidance).toBe('Hello World');
            });
        });

        describe('setState before init', () => {
            it('logs warning and ignores update', () => {
                resetStore();
                setState('ui', { historyExpanded: true });

                expect(log.warn).toHaveBeenCalledWith(
                    '[Store] setState called before init, ignoring',
                );
                expect(getStateOrNull()).toBeNull();
            });
        });
    });

    // -------------------------------------------------------------------------
    // Subscription System
    // -------------------------------------------------------------------------

    describe('Subscription System', () => {
        beforeEach(() => {
            initStore();
        });

        describe('subscribe', () => {
            it('adds listener that gets called on matching slice change', async () => {
                const callback = vi.fn();
                subscribe(['character'], callback);

                setState('character', { character: null });
                await Promise.resolve();

                expect(callback).toHaveBeenCalledTimes(1);
            });

            it('does not call listener for non-matching slice', async () => {
                const callback = vi.fn();
                subscribe(['character'], callback);

                setState('ui', { historyExpanded: true });
                await Promise.resolve();

                expect(callback).not.toHaveBeenCalled();
            });

            it('supports multiple slices per subscription', async () => {
                const callback = vi.fn();
                subscribe(['character', 'session'], callback);

                setState('character', { character: null });
                await Promise.resolve();
                expect(callback).toHaveBeenCalledTimes(1);

                setState('session', { activeSessionId: 'test-id' });
                await Promise.resolve();
                expect(callback).toHaveBeenCalledTimes(2);
            });

            it('supports multiple subscribers', async () => {
                const callback1 = vi.fn();
                const callback2 = vi.fn();

                subscribe(['ui'], callback1);
                subscribe(['ui'], callback2);

                setState('ui', { historyExpanded: true });
                await Promise.resolve();

                expect(callback1).toHaveBeenCalledTimes(1);
                expect(callback2).toHaveBeenCalledTimes(1);
            });

            it('returns unsubscribe function', async () => {
                const callback = vi.fn();
                const unsub = subscribe(['ui'], callback);

                setState('ui', { historyExpanded: true });
                await Promise.resolve();
                expect(callback).toHaveBeenCalledTimes(1);

                unsub();

                setState('ui', { historyExpanded: false });
                await Promise.resolve();
                expect(callback).toHaveBeenCalledTimes(1); // Still 1, not called again
            });
        });

        describe('listener error handling', () => {
            it('catches and logs listener errors', async () => {
                const errorCallback = vi.fn(() => {
                    throw new Error('Listener exploded');
                });
                const normalCallback = vi.fn();

                subscribe(['ui'], errorCallback);
                subscribe(['ui'], normalCallback);

                setState('ui', { historyExpanded: true });
                await Promise.resolve();

                expect(log.error).toHaveBeenCalledWith(
                    '[Store] Listener callback failed:',
                    expect.any(Error),
                );
                // Other listeners still called
                expect(normalCallback).toHaveBeenCalled();
            });
        });
    });

    // -------------------------------------------------------------------------
    // Batching
    // -------------------------------------------------------------------------

    describe('Batching', () => {
        beforeEach(() => {
            initStore();
        });

        describe('automatic microtask batching', () => {
            it('batches multiple sync setState calls into single notification', async () => {
                const callback = vi.fn();
                subscribe(['ui', 'guidance'], callback);

                // Multiple setState calls in same sync block
                setState('ui', { historyExpanded: true });
                setState('guidance', { userGuidance: 'test' });
                setState('ui', { sessionListExpanded: true });

                // Not yet notified (still in sync block)
                expect(callback).not.toHaveBeenCalled();

                // After microtask, single notification
                await Promise.resolve();
                expect(callback).toHaveBeenCalledTimes(1);
            });

            it('accumulates changed slices across batched updates', async () => {
                const uiCallback = vi.fn();
                const guidanceCallback = vi.fn();
                const bothCallback = vi.fn();

                subscribe(['ui'], uiCallback);
                subscribe(['guidance'], guidanceCallback);
                subscribe(['ui', 'guidance'], bothCallback);

                setState('ui', { historyExpanded: true });
                setState('guidance', { userGuidance: 'test' });

                await Promise.resolve();

                expect(uiCallback).toHaveBeenCalledTimes(1);
                expect(guidanceCallback).toHaveBeenCalledTimes(1);
                expect(bothCallback).toHaveBeenCalledTimes(1);
            });
        });

        describe('explicit batch()', () => {
            it('groups updates with single notification', async () => {
                const callback = vi.fn();
                subscribe(['ui', 'guidance', 'character'], callback);

                batch(() => {
                    setState('ui', { historyExpanded: true });
                    setState('guidance', { userGuidance: 'test' });
                    setState('character', { character: null });
                });

                await Promise.resolve();
                expect(callback).toHaveBeenCalledTimes(1);
            });

            it('applies all updates immediately within batch', () => {
                batch(() => {
                    setState('ui', { historyExpanded: true });
                    // Can read updated value within same batch
                    expect(getState().historyExpanded).toBe(true);

                    setState('guidance', { userGuidance: 'test' });
                    expect(getState().userGuidance).toBe('test');
                });
            });

            it('handles nested batches correctly', async () => {
                const callback = vi.fn();
                subscribe(['ui', 'guidance'], callback);

                batch(() => {
                    setState('ui', { historyExpanded: true });

                    batch(() => {
                        setState('guidance', { userGuidance: 'nested' });
                    });

                    // Inner batch shouldn't trigger notification yet
                    expect(callback).not.toHaveBeenCalled();
                });

                // Outer batch complete, now notification scheduled
                await Promise.resolve();
                expect(callback).toHaveBeenCalledTimes(1);
            });

            it('handles errors within batch gracefully', async () => {
                const callback = vi.fn();
                subscribe(['ui'], callback);

                expect(() => {
                    batch(() => {
                        setState('ui', { historyExpanded: true });
                        throw new Error('Batch error');
                    });
                }).toThrow('Batch error');

                // Notification should still happen for successful updates
                await Promise.resolve();
                expect(callback).toHaveBeenCalledTimes(1);
                expect(getState().historyExpanded).toBe(true);
            });
        });
    });

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    describe('Lifecycle', () => {
        describe('init', () => {
            it('creates fresh initial state', () => {
                initStore();
                const state = getState();

                expect(state.character).toBeNull();
                expect(state.activeStage).toBe('score');
                expect(state.isGenerating).toBe(false);
                expect(state.iterationCount).toBe(0);
            });

            it('clears pending notifications', async () => {
                initStore();
                const callback = vi.fn();
                subscribe(['ui'], callback);

                // Start an update
                setState('ui', { historyExpanded: true });
                // Immediately re-init (clears pending)
                initStore();

                await Promise.resolve();
                // The callback might be called once from the setState before init
                // but state should be fresh
                expect(getState().historyExpanded).toBe(false);
            });

            it('can be called multiple times', () => {
                initStore();
                setState('guidance', { userGuidance: 'test' });

                initStore(); // Re-init
                expect(getState().userGuidance).toBe(''); // Fresh state
            });
        });

        describe('reset', () => {
            it('clears state to null', () => {
                initStore();
                expect(getStateOrNull()).not.toBeNull();

                resetStore();
                expect(getStateOrNull()).toBeNull();
            });

            it('notifies all subscribers before clearing', async () => {
                initStore();
                const callback = vi.fn();
                subscribe(['ui'], callback);

                resetStore();
                // Reset notifies synchronously
                expect(callback).toHaveBeenCalled();
            });

            it('clears pending slices', async () => {
                initStore();
                const callback = vi.fn();
                subscribe(['ui'], callback);

                setState('ui', { historyExpanded: true });
                resetStore();

                // Re-init and verify no stale notifications
                callback.mockClear();
                initStore();

                await Promise.resolve();
                // Should not receive notification for pre-reset setState
                expect(callback).not.toHaveBeenCalled();
            });
        });
    });

    // -------------------------------------------------------------------------
    // createInitialState
    // -------------------------------------------------------------------------

    describe('createInitialState', () => {
        it('creates state with expected defaults', () => {
            const state = createInitialState();

            // Character
            expect(state.character).toBeNull();

            // Fields
            expect(state.selectedFields).toEqual({});
            expect(state.stageFields.base).toEqual({});
            expect(state.stageFields.linked).toBe(true);

            // Session
            expect(state.activeSessionId).toBeNull();
            expect(state.sessions).toEqual([]);
            expect(state.sessionsLoaded).toBe(false);
            expect(state.hasUnsavedChanges).toBe(false);

            // Pipeline
            expect(state.stageStatus).toEqual({
                score: 'pending',
                rewrite: 'pending',
                analyze: 'pending',
            });
            expect(state.stageResults).toEqual({
                score: null,
                rewrite: null,
                analyze: null,
            });
            expect(state.activeStage).toBe('score');

            // Generation
            expect(state.isGenerating).toBe(false);
            expect(state.abortController).toBeNull();
            expect(state.iterationCount).toBe(0);
            expect(state.iterationHistory).toEqual([]);

            // Search
            expect(state.searchQuery).toBe('');
            expect(state.searchResults).toEqual([]);
            expect(state.searchSelectedIndex).toBe(-1);
            expect(state.dropdownOpen).toBe(false);

            // UI
            expect(state.sessionListExpanded).toBe(false);
            expect(state.historyExpanded).toBe(false);
            expect(state.viewingHistoryIndex).toBeNull();
        });

        it('creates independent state objects', () => {
            const state1 = createInitialState();
            const state2 = createInitialState();

            state1.userGuidance = 'modified';
            expect(state2.userGuidance).toBe('');
        });
    });

    // -------------------------------------------------------------------------
    // Edge Cases
    // -------------------------------------------------------------------------

    describe('Edge Cases', () => {
        beforeEach(() => {
            initStore();
        });

        it('handles rapid subscribe/unsubscribe', async () => {
            const callback = vi.fn();

            const unsub1 = subscribe(['ui'], callback);
            const unsub2 = subscribe(['ui'], callback);

            unsub1();
            setState('ui', { historyExpanded: true });
            await Promise.resolve();

            // Only one subscription remains
            expect(callback).toHaveBeenCalledTimes(1);

            unsub2();
            setState('ui', { historyExpanded: false });
            await Promise.resolve();

            // No subscriptions remain
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('handles empty slice array subscription', async () => {
            const callback = vi.fn();
            subscribe([], callback);

            setState('ui', { historyExpanded: true });
            await Promise.resolve();

            // Never notified (no slices match)
            expect(callback).not.toHaveBeenCalled();
        });

        it('handles setState with no actual changes', async () => {
            const callback = vi.fn();
            subscribe(['ui'], callback);

            // Set to same value
            setState('ui', { historyExpanded: false }); // Already false
            await Promise.resolve();

            // Still notified (store doesn't do deep equality)
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('handles all slice types', async () => {
            const slices: StateSlice[] = [
                'character',
                'session',
                'pipeline',
                'results',
                'config',
                'fields',
                'search',
                'ui',
                'guidance',
            ];

            for (const slice of slices) {
                const callback = vi.fn();
                const unsub = subscribe([slice], callback);

                // Trigger update for this slice
                switch (slice) {
                    case 'character':
                        setState('character', { character: null });
                        break;
                    case 'session':
                        setState('session', { activeSessionId: 'test' });
                        break;
                    case 'pipeline':
                        setState('pipeline', { isGenerating: true });
                        break;
                    case 'results':
                        setState('results', { iterationCount: 1 });
                        break;
                    case 'config':
                        setState('config', {
                            stageConfigs: getState().stageConfigs,
                        });
                        break;
                    case 'fields':
                        setState('fields', { selectedFields: {} });
                        break;
                    case 'search':
                        setState('search', { searchQuery: 'test' });
                        break;
                    case 'ui':
                        setState('ui', { historyExpanded: true });
                        break;
                    case 'guidance':
                        setState('guidance', { userGuidance: 'test' });
                        break;
                }

                await Promise.resolve();
                expect(callback).toHaveBeenCalled();
                unsub();
            }
        });
    });
});
