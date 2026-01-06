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
 * Generate a unique name by appending a counter suffix if the name already exists.
 * Uses case-insensitive comparison for user-friendliness.
 *
 * @param baseName - The desired name
 * @param existingNames - Array of names that already exist
 * @returns A unique name (baseName if available, or "baseName (N)" where N >= 2)
 *
 * @example
 * ```ts
 * generateUniqueName('Score', ['Score', 'Rewrite'])
 * // => 'Score (2)'
 *
 * generateUniqueName('Score', ['Score', 'Score (2)'])
 * // => 'Score (3)'
 *
 * generateUniqueName('New Preset', ['Score', 'Rewrite'])
 * // => 'New Preset'
 * ```
 */
export function generateUniqueName(
    baseName: string,
    existingNames: string[],
): string {
    const nameSet = new Set(existingNames.map((n) => n.toLowerCase()));

    if (!nameSet.has(baseName.toLowerCase())) {
        return baseName;
    }

    let counter = 2;
    let uniqueName = `${baseName} (${counter})`;
    while (nameSet.has(uniqueName.toLowerCase())) {
        counter++;
        uniqueName = `${baseName} (${counter})`;
    }
    return uniqueName;
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
