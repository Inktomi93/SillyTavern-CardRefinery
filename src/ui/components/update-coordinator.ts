// src/ui/components/update-coordinator.ts
// =============================================================================
// UI UPDATE COORDINATOR
// =============================================================================
//
// Centralizes UI update logic to avoid scattered refreshAllUI() calls across
// components. Components register their update functions, and the coordinator
// triggers them based on what changed.
//
// This provides:
// - Single source of truth for which updates happen together
// - Debouncing to prevent excessive re-renders
// - Clear dependency management between components
// - Automatic subscription to store state changes
//
// =============================================================================

import { log } from '../../shared';
import { store } from '../../state/store';
import type { StateSlice } from '../../types/store';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Categories of state changes that trigger different UI updates.
 */
export type UpdateCategory =
    | 'character' // Character selection changed
    | 'session' // Session loaded/created/deleted
    | 'stage' // Active stage changed
    | 'pipeline' // Pipeline status changed (running/complete/error)
    | 'fields' // Field selection changed
    | 'config' // Stage config changed
    | 'results' // Results updated
    | 'all'; // Full refresh

/**
 * Registered update function with metadata.
 */
interface UpdateRegistration {
    fn: () => void;
    categories: UpdateCategory[];
    storeUnsubscribe?: () => void;
}

// =============================================================================
// CATEGORY TO SLICE MAPPING
// =============================================================================

/**
 * Maps UpdateCategory to StateSlice for store subscriptions.
 * When a category is triggered, the corresponding slices are watched.
 */
const CATEGORY_TO_SLICES: Record<UpdateCategory, StateSlice[]> = {
    character: ['character'],
    session: ['session'],
    stage: ['pipeline'], // activeStage is in pipeline slice
    pipeline: ['pipeline'],
    fields: ['fields'],
    config: ['config'],
    results: ['results'],
    all: [
        'character',
        'session',
        'pipeline',
        'results',
        'config',
        'fields',
        'search',
        'ui',
        'guidance',
    ],
};

// =============================================================================
// COORDINATOR
// =============================================================================

const registrations: Map<string, UpdateRegistration> = new Map();
let pendingCategories: Set<UpdateCategory> = new Set();
let updateScheduled = false;

/**
 * Register an update function for specific categories.
 *
 * The function will be called when:
 * 1. triggerUpdate() is called with matching categories (legacy)
 * 2. The store's corresponding slices change (automatic)
 *
 * @param id - Unique identifier for this registration
 * @param fn - Update function to call
 * @param categories - Which change categories trigger this update
 * @returns Cleanup function to unregister
 *
 * @example
 * ```ts
 * const cleanup = registerUpdate('stageTabs', updateStageTabs, ['stage', 'pipeline']);
 * // Later:
 * cleanup();
 * ```
 */
export function registerUpdate(
    id: string,
    fn: () => void,
    categories: UpdateCategory[],
): () => void {
    // Calculate which store slices to watch
    const slices = [
        ...new Set(categories.flatMap((c) => CATEGORY_TO_SLICES[c])),
    ];

    // Subscribe to store for automatic updates
    const storeUnsubscribe = store.subscribe(slices, () => {
        // When store changes, trigger the update through coordinator
        // This ensures batching still works
        triggerUpdate(...categories);
    });

    registrations.set(id, { fn, categories, storeUnsubscribe });

    return () => {
        const reg = registrations.get(id);
        reg?.storeUnsubscribe?.();
        registrations.delete(id);
    };
}

/**
 * Trigger UI updates for specific categories.
 * Updates are batched within a microtask for efficiency.
 *
 * Note: With store integration, you often don't need to call this directly.
 * Store state changes automatically trigger registered updates.
 *
 * @param categories - Categories of changes that occurred
 *
 * @example
 * ```ts
 * // After changing active stage:
 * triggerUpdate('stage', 'config');
 *
 * // After session load:
 * triggerUpdate('session', 'fields', 'config', 'results');
 * ```
 */
export function triggerUpdate(...categories: UpdateCategory[]): void {
    for (const cat of categories) {
        pendingCategories.add(cat);
    }

    if (!updateScheduled) {
        updateScheduled = true;
        queueMicrotask(flushUpdates);
    }
}

/**
 * Flush pending updates synchronously.
 * Normally updates are batched, but this forces immediate execution.
 */
export function flushUpdates(): void {
    updateScheduled = false;

    if (pendingCategories.size === 0) return;

    const categories = pendingCategories;
    pendingCategories = new Set();

    const hasAll = categories.has('all');

    for (const reg of registrations.values()) {
        if (hasAll || reg.categories.some((c) => categories.has(c))) {
            try {
                reg.fn();
            } catch (e) {
                log.error('UpdateCoordinator update failed:', e);
            }
        }
    }
}

/**
 * Clear all registrations (for cleanup on popup close).
 */
export function clearRegistrations(): void {
    // Unsubscribe all store subscriptions
    for (const reg of registrations.values()) {
        reg.storeUnsubscribe?.();
    }

    registrations.clear();
    pendingCategories.clear();
    updateScheduled = false;
}

// =============================================================================
// CONVENIENCE HELPERS
// =============================================================================

/**
 * Trigger a full UI refresh.
 */
export function refreshAll(): void {
    triggerUpdate('all');
}

/**
 * Trigger updates after character change.
 */
export function refreshAfterCharacterChange(): void {
    triggerUpdate(
        'character',
        'session',
        'fields',
        'config',
        'results',
        'pipeline',
    );
}

/**
 * Trigger updates after session change.
 */
export function refreshAfterSessionChange(): void {
    triggerUpdate(
        'session',
        'fields',
        'config',
        'results',
        'pipeline',
        'stage',
    );
}

/**
 * Trigger updates after stage change.
 */
export function refreshAfterStageChange(): void {
    triggerUpdate('stage', 'config', 'results');
}
