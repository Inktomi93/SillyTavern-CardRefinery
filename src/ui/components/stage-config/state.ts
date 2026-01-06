// src/ui/components/stage-config/state.ts
// =============================================================================
// MODULE STATE
// =============================================================================

// =============================================================================
// INPUT DEBOUNCE TRACKING
// =============================================================================

// Track active debounced input handlers so we can flush them on close
type DebouncedFn = ReturnType<typeof SillyTavern.libs.lodash.debounce>;
let pendingInputDebounces: DebouncedFn[] = [];

/**
 * Add a debounced function to the tracking list.
 */
export function addPendingInput(fn: DebouncedFn): void {
    pendingInputDebounces.push(fn);
}

/**
 * Remove a debounced function from the tracking list.
 */
export function removePendingInput(fn: DebouncedFn): void {
    const idx = pendingInputDebounces.indexOf(fn);
    if (idx !== -1) pendingInputDebounces.splice(idx, 1);
}

/**
 * Flush all pending debounced input handlers.
 * Call this before forceSave to ensure all typed content is captured.
 */
export function flushPendingInputs(): void {
    for (const fn of pendingInputDebounces) {
        fn.flush();
    }
}

/**
 * Clear tracked debounces (call on cleanup).
 */
export function clearPendingInputs(): void {
    for (const fn of pendingInputDebounces) {
        fn.cancel();
    }
    pendingInputDebounces = [];
}

// =============================================================================
// FIELD TOKEN COUNTS
// =============================================================================

// Store token counts for total calculation
export const fieldTokenCounts: Map<string, number> = new Map();
