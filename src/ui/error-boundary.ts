// src/ui/error-boundary.ts
// =============================================================================
// ERROR BOUNDARY UTILITIES
// =============================================================================
//
// Wrapper functions that provide error handling for UI components.
// Prevents a single component failure from breaking the entire popup.
//
// Features:
// - Debug-mode aware: Shows minimal info in production, detailed in debug mode
// - Uses existing log module for consistent logging
// - Fallback UI for render failures
// - Toast notifications for user-visible errors
//
// =============================================================================

import { log, toast } from '../shared';
import { CSS_PREFIX } from '../shared/constants';
import { getSettings } from '../data/settings';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Configuration options for error boundaries.
 */
export interface ErrorBoundaryOptions {
    /** Component name for logging and display */
    name: string;
    /** Custom fallback HTML or generator function */
    fallback?: string | ((error: Error) => string);
    /** Additional error handler callback */
    onError?: (error: Error) => void;
    /** Whether to show toast notification (default: false for render, true for events) */
    showToast?: boolean;
}

// =============================================================================
// ERROR FALLBACK RENDERING
// =============================================================================

/**
 * Check if debug mode is enabled.
 * Safely handles case where settings aren't loaded yet.
 */
function isDebugMode(): boolean {
    try {
        return getSettings().debugMode ?? false;
    } catch {
        return false;
    }
}

/**
 * Render a fallback UI when a component fails.
 *
 * In debug mode: Shows component name + error message
 * In production: Shows component name + generic failure message
 *
 * @param componentName - Name of the failed component
 * @param error - The error that occurred
 * @returns HTML string for the fallback UI
 */
function renderErrorFallback(componentName: string, error: Error): string {
    const debug = isDebugMode();
    const errorMessage = debug
        ? error.message || 'Unknown error'
        : 'Failed to render';

    return /* html */ `
        <div class="${CSS_PREFIX}-error-fallback">
            <div class="${CSS_PREFIX}-error-fallback__icon">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div class="${CSS_PREFIX}-error-fallback__content">
                <div class="${CSS_PREFIX}-error-fallback__title">
                    ${componentName}
                </div>
                <div class="${CSS_PREFIX}-error-fallback__message">
                    ${errorMessage}
                </div>
                ${
                    debug && error.stack
                        ? /* html */ `
                    <details class="${CSS_PREFIX}-error-fallback__details">
                        <summary>Stack trace</summary>
                        <pre>${error.stack}</pre>
                    </details>
                `
                        : ''
                }
            </div>
        </div>
    `;
}

// =============================================================================
// ERROR HELPERS
// =============================================================================

/**
 * Normalize any thrown value to an Error object.
 */
function toError(e: unknown): Error {
    if (e instanceof Error) return e;
    return new Error(String(e));
}

/**
 * Handle an error with logging and optional callbacks.
 */
function handleError(
    error: Error,
    options: ErrorBoundaryOptions,
    context: string,
): void {
    log.error(`[${options.name}] ${context}:`, error);
    options.onError?.(error);

    if (options.showToast) {
        const message = isDebugMode()
            ? `${options.name}: ${error.message}`
            : `${options.name} failed`;
        toast.error(message);
    }
}

// =============================================================================
// RENDER BOUNDARY
// =============================================================================

/**
 * Wrap a render function with error handling.
 *
 * If the render function throws, returns fallback HTML instead.
 * Logs the error and optionally calls onError callback.
 *
 * @param renderFn - Function that returns HTML string
 * @param options - Error boundary configuration
 * @returns Wrapped function with same signature
 *
 * @example
 * ```ts
 * const safeRender = withRenderBoundary(renderStageTabs, {
 *     name: 'StageTabs',
 * });
 *
 * // If renderStageTabs throws, returns fallback HTML
 * const html = safeRender();
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withRenderBoundary<T extends (...args: any[]) => string>(
    renderFn: T,
    options: ErrorBoundaryOptions,
): T {
    return ((...args: Parameters<T>): string => {
        try {
            return renderFn(...args);
        } catch (e) {
            const error = toError(e);
            handleError(error, options, 'Render failed');

            // Return fallback HTML
            if (typeof options.fallback === 'function') {
                return options.fallback(error);
            }
            return options.fallback ?? renderErrorFallback(options.name, error);
        }
    }) as T;
}

// =============================================================================
// UPDATE BOUNDARY
// =============================================================================

/**
 * Wrap an update function with error handling.
 *
 * If the update function throws, logs the error but doesn't crash.
 * The component will remain in its previous state.
 *
 * @param updateFn - Function that updates DOM
 * @param options - Error boundary configuration
 * @returns Wrapped function with same signature
 *
 * @example
 * ```ts
 * const safeUpdate = withUpdateBoundary(updateResults, {
 *     name: 'Results',
 *     showToast: true,
 * });
 *
 * // If updateResults throws, logs error and shows toast
 * safeUpdate();
 * ```
 */
export function withUpdateBoundary<T extends (...args: unknown[]) => void>(
    updateFn: T,
    options: ErrorBoundaryOptions,
): T {
    return ((...args: Parameters<T>): void => {
        try {
            updateFn(...args);
        } catch (e) {
            const error = toError(e);
            handleError(
                error,
                { ...options, showToast: options.showToast ?? false },
                'Update failed',
            );
        }
    }) as T;
}

// =============================================================================
// EVENT BOUNDARY
// =============================================================================

/**
 * Wrap an event binding function with error handling.
 *
 * If event binding throws, logs the error and returns a no-op cleanup.
 * The component will be rendered but non-interactive.
 *
 * @param bindFn - Function that binds events and returns cleanup
 * @param options - Error boundary configuration
 * @returns Wrapped function with same signature
 *
 * @example
 * ```ts
 * const safeBind = withEventBoundary(bindStageTabsEvents, {
 *     name: 'StageTabs',
 *     showToast: true,
 * });
 *
 * // If bindStageTabsEvents throws, returns no-op cleanup
 * const cleanup = safeBind(container);
 * ```
 */
export function withEventBoundary<
    T extends (container: HTMLElement) => () => void,
>(bindFn: T, options: ErrorBoundaryOptions): T {
    return ((container: HTMLElement): (() => void) => {
        try {
            return bindFn(container);
        } catch (e) {
            const error = toError(e);
            handleError(
                error,
                { ...options, showToast: options.showToast ?? true },
                'Event binding failed',
            );

            // Return no-op cleanup
            return () => {};
        }
    }) as T;
}

// =============================================================================
// TRY-CATCH HELPERS
// =============================================================================

/**
 * Execute a function with error handling, useful for inline try/catch.
 *
 * @param fn - Function to execute
 * @param options - Error handling options
 * @returns Result of fn, or undefined on error
 *
 * @example
 * ```ts
 * // Instead of:
 * try { initDrawer(el); } catch (e) { log.error(...); }
 *
 * // Use:
 * tryCatch(() => initDrawer(el), { name: 'Drawer' });
 * ```
 */
export function tryCatch<T>(
    fn: () => T,
    options: {
        name: string;
        showToast?: boolean;
        onError?: (error: Error) => void;
    },
): T | undefined {
    try {
        return fn();
    } catch (e) {
        const error = toError(e);
        log.error(`[${options.name}] Failed:`, error);
        options.onError?.(error);
        if (options.showToast) {
            const message = isDebugMode()
                ? `${options.name}: ${error.message}`
                : `${options.name} failed`;
            toast.error(message);
        }
        return undefined;
    }
}

/**
 * Execute an async function with error handling.
 *
 * @param fn - Async function to execute
 * @param options - Error handling options
 * @returns Result of fn, or undefined on error
 */
export async function tryCatchAsync<T>(
    fn: () => Promise<T>,
    options: {
        name: string;
        showToast?: boolean;
        onError?: (error: Error) => void;
    },
): Promise<T | undefined> {
    try {
        return await fn();
    } catch (e) {
        const error = toError(e);
        log.error(`[${options.name}] Failed:`, error);
        options.onError?.(error);
        if (options.showToast) {
            const message = isDebugMode()
                ? `${options.name}: ${error.message}`
                : `${options.name} failed`;
            toast.error(message);
        }
        return undefined;
    }
}
