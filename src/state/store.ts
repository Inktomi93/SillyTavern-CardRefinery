// src/state/store.ts
// =============================================================================
// OBSERVABLE STORE
// =============================================================================
//
// Centralized state management with fine-grained subscriptions.
// This is the single source of truth for all popup state.
//
// Key features:
// - Slice-based subscriptions (components only update when their data changes)
// - Microtask batching (multiple updates become one notification)
// - Batch transactions (explicit grouping of related updates)
// - Backward compatible with existing getState() pattern
//
// =============================================================================

import { log } from '../shared';
import type { PopupState } from '../types/state';
import type { Store, StoreListener, StateSlice } from '../types/store';
import { SLICE_PROPERTIES } from '../types/store';
import { getStageDefaults } from '../data/settings';

// =============================================================================
// INITIAL STATE FACTORY
// =============================================================================

/**
 * Creates fresh initial state for the popup.
 * Extracted here to avoid circular dependency with popup-state.ts.
 */
export function createInitialState(): PopupState {
    return {
        character: null,
        selectedFields: {}, // Deprecated, kept for compatibility
        stageFields: {
            base: {},
            linked: true,
            overrides: {},
        },

        activeSessionId: null,
        sessions: [],
        sessionsLoaded: false,
        hasUnsavedChanges: false,

        stageStatus: {
            score: 'pending',
            rewrite: 'pending',
            analyze: 'pending',
        },
        stageResults: { score: null, rewrite: null, analyze: null },
        stageConfigs: {
            score: getStageDefaults('score'),
            rewrite: getStageDefaults('rewrite'),
            analyze: getStageDefaults('analyze'),
        },
        activeStage: 'score',
        iterationCount: 0,
        iterationHistory: [],
        userGuidance: '',

        isGenerating: false,
        abortController: null,

        searchQuery: '',
        searchResults: [],
        searchSelectedIndex: -1,
        dropdownOpen: false,

        sessionListExpanded: false,
        historyExpanded: false,

        viewingHistoryIndex: null,
    };
}

// =============================================================================
// STORE IMPLEMENTATION
// =============================================================================

class StoreImpl implements Store {
    private state: PopupState | null = null;
    private listeners: Set<StoreListener> = new Set();
    private batchDepth = 0;
    private pendingSlices: Set<StateSlice> = new Set();
    private notificationScheduled = false;

    // -------------------------------------------------------------------------
    // State Access
    // -------------------------------------------------------------------------

    getState(): Readonly<PopupState> {
        if (!this.state) {
            throw new Error(
                '[Store] Not initialized. Call init() before accessing state.',
            );
        }
        return this.state;
    }

    getStateOrNull(): Readonly<PopupState> | null {
        return this.state;
    }

    // -------------------------------------------------------------------------
    // State Mutations
    // -------------------------------------------------------------------------

    setState<K extends keyof PopupState>(
        slice: StateSlice,
        updates:
            | Pick<PopupState, K>
            | ((state: PopupState) => Pick<PopupState, K>),
    ): void {
        if (!this.state) {
            log.warn('[Store] setState called before init, ignoring');
            return;
        }

        // Resolve updater function if provided
        const resolved =
            typeof updates === 'function' ? updates(this.state) : updates;

        // Apply update (shallow merge)
        this.state = { ...this.state, ...resolved };

        // Track which slice changed
        this.pendingSlices.add(slice);

        // Schedule notification (unless we're in a batch)
        if (this.batchDepth === 0) {
            this.scheduleNotification();
        }
    }

    batch(fn: () => void): void {
        this.batchDepth++;
        try {
            fn();
        } finally {
            this.batchDepth--;
            if (this.batchDepth === 0 && this.pendingSlices.size > 0) {
                this.scheduleNotification();
            }
        }
    }

    // -------------------------------------------------------------------------
    // Subscriptions
    // -------------------------------------------------------------------------

    subscribe(slices: StateSlice[], callback: () => void): () => void {
        const listener: StoreListener = { slices, callback };
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    init(): void {
        this.state = createInitialState();
        this.pendingSlices.clear();
        this.notificationScheduled = false;
        log.debug('[Store] Initialized');
    }

    reset(): void {
        // Notify all listeners that state is being cleared
        this.notifyAll();

        // Clear state
        this.state = null;
        this.pendingSlices.clear();
        this.notificationScheduled = false;

        log.debug('[Store] Reset');
    }

    // -------------------------------------------------------------------------
    // Internal: Notification System
    // -------------------------------------------------------------------------

    /**
     * Schedule notification for next microtask.
     * Multiple setState calls in the same sync block get batched.
     */
    private scheduleNotification(): void {
        if (this.notificationScheduled) return;

        this.notificationScheduled = true;
        queueMicrotask(() => this.flushNotifications());
    }

    /**
     * Notify listeners whose subscribed slices have changed.
     */
    private flushNotifications(): void {
        this.notificationScheduled = false;

        if (this.pendingSlices.size === 0) return;

        const changedSlices = Array.from(this.pendingSlices);
        this.pendingSlices.clear();

        log.debug('[Store] Notifying for slices:', changedSlices);

        for (const listener of this.listeners) {
            // Check if any of listener's subscribed slices changed
            const shouldNotify = listener.slices.some((s) =>
                changedSlices.includes(s),
            );

            if (shouldNotify) {
                try {
                    listener.callback();
                } catch (e) {
                    log.error('[Store] Listener callback failed:', e);
                }
            }
        }
    }

    /**
     * Notify all listeners (used on reset).
     */
    private notifyAll(): void {
        const allSlices = Object.keys(SLICE_PROPERTIES) as StateSlice[];
        for (const slice of allSlices) {
            this.pendingSlices.add(slice);
        }
        // Flush synchronously for reset
        this.flushNotifications();
    }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

/**
 * The global store instance.
 * Use this for all state access and mutations.
 */
export const store = new StoreImpl();

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * Get current state (throws if not initialized).
 * @see Store.getState
 */
export const getState = (): Readonly<PopupState> => store.getState();

/**
 * Get current state or null.
 * @see Store.getStateOrNull
 */
export const getStateOrNull = (): Readonly<PopupState> | null =>
    store.getStateOrNull();

/**
 * Update state for a slice.
 * @see Store.setState
 */
export const setState = <K extends keyof PopupState>(
    slice: StateSlice,
    updates: Pick<PopupState, K> | ((state: PopupState) => Pick<PopupState, K>),
): void => store.setState(slice, updates);

/**
 * Batch multiple updates.
 * @see Store.batch
 */
export const batch = (fn: () => void): void => store.batch(fn);

/**
 * Subscribe to state changes.
 * @see Store.subscribe
 */
export const subscribe = (
    slices: StateSlice[],
    callback: () => void,
): (() => void) => store.subscribe(slices, callback);

/**
 * Initialize the store.
 * @see Store.init
 */
export const initStore = (): void => store.init();

/**
 * Reset the store.
 * @see Store.reset
 */
export const resetStore = (): void => store.reset();
