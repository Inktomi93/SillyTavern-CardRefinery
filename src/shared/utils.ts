// src/shared/utils.ts
// =============================================================================
// GENERAL UTILITIES
//
// Utilities that add value beyond what ST/lodash already provide.
// For lodash functions, use libs().lodash directly.
// =============================================================================

// =============================================================================
// HASHING
// =============================================================================

/**
 * Simple hash function for strings (djb2 algorithm).
 * Fast and produces reasonably distributed values.
 * Good for generating cache keys, storage keys, etc.
 *
 * @param str - String to hash
 * @returns Hash as base36 string
 *
 * @example
 * ```ts
 * const key = `myext_${hashString(characterName + avatar)}`;
 * await localforage.setItem(key, data);
 * ```
 */
export function hashString(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
}

/**
 * Generate a unique key for a character.
 * Combines avatar (unique identifier) with name for human readability.
 *
 * @param name - Character name
 * @param avatar - Character avatar filename
 * @param prefix - Optional prefix for the key
 * @returns Unique storage key
 */
export function getCharacterKey(
    name: string,
    avatar: string,
    prefix: string = 'ext',
): string {
    const uniqueHash = hashString(`${avatar}::${name}`);
    return `${prefix}_${uniqueHash}`;
}

// =============================================================================
// STRING UTILITIES (only what lodash doesn't have)
// =============================================================================

/**
 * Check if a string has meaningful content (not null, undefined, or whitespace-only).
 */
export function hasContent(str: string | null | undefined): boolean {
    return typeof str === 'string' && str.trim().length > 0;
}

/**
 * Count words in a string.
 */
export function countWords(str: string): number {
    if (!str) return 0;
    return str
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0).length;
}

// =============================================================================
// ASYNC UTILITIES (useful patterns not in lodash)
// =============================================================================

/**
 * Retry an async function with exponential backoff.
 *
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries (default 3)
 * @param baseDelay - Base delay in ms (default 1000)
 * @returns Result of the function
 *
 * @example
 * ```ts
 * const result = await retry(
 *     () => fetch('/api/data'),
 *     3,
 *     1000
 * );
 * ```
 */
export async function retry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000,
): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));

            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

// =============================================================================
// VALIDATION (useful assertions)
// =============================================================================

/**
 * Assert a condition, throwing if false.
 */
export function assert(condition: boolean, message: string): asserts condition {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

/**
 * Assert a value is defined (not null or undefined).
 */
export function assertDefined<T>(
    value: T | null | undefined,
    name: string,
): asserts value is T {
    if (value === null || value === undefined) {
        throw new Error(`Expected ${name} to be defined`);
    }
}

// =============================================================================
// TIMING
// =============================================================================

/**
 * Create a simple timer for measuring execution time.
 *
 * @example
 * ```ts
 * const timer = createTimer();
 * await doSomething();
 * console.log(`Took ${timer.elapsed()}ms`);
 * ```
 */
export function createTimer(): { elapsed: () => number; reset: () => void } {
    let start = Date.now();

    return {
        elapsed(): number {
            return Date.now() - start;
        },
        reset(): void {
            start = Date.now();
        },
    };
}

/**
 * Format milliseconds as human-readable duration.
 */
export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000)
        return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

// =============================================================================
// JSON UTILITIES
// =============================================================================

/**
 * Safe JSON parse with fallback.
 */
export function parseJSON<T>(json: string, fallback: T): T {
    try {
        return JSON.parse(json) as T;
    } catch {
        return fallback;
    }
}

/**
 * Check if a string is valid JSON.
 */
export function isValidJSON(str: string): boolean {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
}

// =============================================================================
// TEMPLATE LITERAL HELPERS
// =============================================================================

/**
 * Tagged template literal for HTML strings.
 *
 * This is a zero-cost identity function that enables:
 * - HTML linting via @html-eslint/eslint-plugin
 * - IDE syntax highlighting for HTML in template literals
 * - Type safety for HTML string interpolation
 *
 * @example
 * ```ts
 * // Enable HTML linting for this template
 * const markup = html`<div class="container">${content}</div>`;
 *
 * // Alternative: use comment annotation (no import needed)
 * const markup = /* html *\/ `<div class="container">${content}</div>`;
 * ```
 *
 * @param strings - Template literal strings
 * @param values - Interpolated values
 * @returns The concatenated string (identity function)
 */
export function html(
    strings: TemplateStringsArray,
    ...values: unknown[]
): string {
    return strings.reduce((result, str, i) => {
        const value = i < values.length ? String(values[i]) : '';
        return result + str + value;
    }, '');
}

// =============================================================================
// LODASH REMINDER
// =============================================================================
// For common utilities, use libs().lodash directly:
//   - _.truncate(str, { length: 100 })
//   - _.chunk(array, size)
//   - _.groupBy(array, keyFn)
//   - _.uniqBy(array, keyFn)
//   - _.pick(obj, keys)
//   - _.omit(obj, keys)
//   - _.clamp(num, min, max)
//   - _.isEqual(a, b)
//   - _.debounce(fn, wait)
//   - _.throttle(fn, wait)
// =============================================================================
