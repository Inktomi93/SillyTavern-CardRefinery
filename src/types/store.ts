// src/types/store.ts
// =============================================================================
// OBSERVABLE STORE TYPES
// =============================================================================
//
// Type definitions for the centralized observable store that provides
// single source of truth for all popup state with fine-grained subscriptions.
//
// =============================================================================

import type { PopupState } from './state';

// =============================================================================
// STATE SLICES
// =============================================================================

/**
 * Fine-grained state slices for targeted subscriptions.
 *
 * Components subscribe to specific slices and only re-render when
 * those slices change, preventing unnecessary updates.
 */
export type StateSlice =
    | 'character' // Character selection
    | 'session' // Session metadata (id, list, loading)
    | 'pipeline' // Pipeline execution (status, generating, abort)
    | 'results' // Stage results and history
    | 'config' // Stage configurations
    | 'fields' // Field selection (base + overrides)
    | 'search' // Character search state
    | 'ui' // UI state (expanded panels, history viewing)
    | 'guidance'; // User guidance text

/**
 * Mapping from slices to their associated PopupState properties.
 * Used by the store to determine which slices changed on setState.
 */
export const SLICE_PROPERTIES: Record<StateSlice, (keyof PopupState)[]> = {
    character: ['character'],
    session: [
        'activeSessionId',
        'sessions',
        'sessionsLoaded',
        'hasUnsavedChanges',
    ],
    pipeline: ['stageStatus', 'activeStage', 'isGenerating', 'abortController'],
    results: ['stageResults', 'iterationHistory', 'iterationCount'],
    config: ['stageConfigs'],
    fields: ['stageFields', 'selectedFields'],
    search: [
        'searchQuery',
        'searchResults',
        'searchSelectedIndex',
        'dropdownOpen',
    ],
    ui: ['sessionListExpanded', 'historyExpanded', 'viewingHistoryIndex'],
    guidance: ['userGuidance'],
};

// =============================================================================
// STORE LISTENER
// =============================================================================

/**
 * A registered listener with its subscribed slices.
 */
export interface StoreListener {
    /** Which state slices this listener cares about */
    slices: StateSlice[];
    /** Callback invoked when any subscribed slice changes */
    callback: () => void;
}

// =============================================================================
// STORE INTERFACE
// =============================================================================

/**
 * Observable store interface.
 *
 * Provides centralized state management with:
 * - Immutable state access via getState()
 * - Slice-targeted updates via setState()
 * - Fine-grained subscriptions via subscribe()
 * - Batched updates via batch()
 *
 * @example
 * ```ts
 * // Subscribe to character changes
 * const unsub = store.subscribe(['character'], () => {
 *     updateCharacterUI();
 * });
 *
 * // Update character (triggers subscribed callbacks)
 * store.setState('character', { character: newChar });
 *
 * // Batch multiple updates (single notification)
 * store.batch(() => {
 *     store.setState('character', { character: newChar });
 *     store.setState('session', { activeSessionId: newId });
 * });
 * ```
 */
export interface Store {
    /**
     * Get current state snapshot (read-only).
     * @throws Error if store not initialized
     */
    getState(): Readonly<PopupState>;

    /**
     * Get current state or null if not initialized.
     * Use for cleanup code that may run after store is reset.
     */
    getStateOrNull(): Readonly<PopupState> | null;

    /**
     * Update state for a specific slice.
     *
     * @param slice - Which slice is being updated (for subscription matching)
     * @param updates - Partial state update or updater function
     *
     * @example
     * ```ts
     * // Direct update
     * store.setState('character', { character: newChar });
     *
     * // Updater function (access current state)
     * store.setState('results', (state) => ({
     *     iterationCount: state.iterationCount + 1
     * }));
     * ```
     */
    setState<K extends keyof PopupState>(
        slice: StateSlice,
        updates:
            | Pick<PopupState, K>
            | ((state: PopupState) => Pick<PopupState, K>),
    ): void;

    /**
     * Batch multiple setState calls into a single notification.
     *
     * All updates within the batch are applied immediately but
     * subscribers are only notified once after the batch completes.
     *
     * @example
     * ```ts
     * store.batch(() => {
     *     store.setState('character', { character: newChar });
     *     store.setState('session', { sessions: newSessions });
     *     store.setState('config', { stageConfigs: newConfigs });
     * });
     * // Subscribers notified once with all changes
     * ```
     */
    batch(fn: () => void): void;

    /**
     * Subscribe to state changes for specific slices.
     *
     * @param slices - Which slices to watch
     * @param callback - Called when any watched slice changes
     * @returns Cleanup function to unsubscribe
     *
     * @example
     * ```ts
     * const unsub = store.subscribe(['character', 'session'], () => {
     *     refreshDropdown();
     * });
     *
     * // Later:
     * unsub();
     * ```
     */
    subscribe(slices: StateSlice[], callback: () => void): () => void;

    /**
     * Initialize the store with fresh state.
     * Called when popup opens.
     */
    init(): void;

    /**
     * Reset the store (clear state, notify all subscribers).
     * Called when popup closes.
     */
    reset(): void;
}
