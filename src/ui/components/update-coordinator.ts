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
//
// =============================================================================

import { log } from '../../shared';

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
}

// =============================================================================
// COORDINATOR
// =============================================================================

const registrations: Map<string, UpdateRegistration> = new Map();
let pendingCategories: Set<UpdateCategory> = new Set();
let updateScheduled = false;

/**
 * Register an update function for specific categories.
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
    registrations.set(id, { fn, categories });
    return () => registrations.delete(id);
}

/**
 * Trigger UI updates for specific categories.
 * Updates are batched within a microtask for efficiency.
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
