// src/shared/tokens.ts
// =============================================================================
// TOKEN COUNTING WITH CACHING & DEBOUNCING
// =============================================================================
//
// This module provides advanced token counting with:
// - In-memory LRU cache (500 entries)
// - Debounced counting for UI input fields
// - Batch counting for multiple texts
//
// For simple token estimation, use estimateTokens() from profiles.ts.
// This module is for when you need caching and UI integration.
//
// =============================================================================

import { log } from './debug';

// =============================================================================
// TYPES
// =============================================================================

type TokenCallback = (tokens: number | null) => void;

interface PendingRequest {
    text: string;
    callbacks: TokenCallback[];
    timeoutId: ReturnType<typeof setTimeout>;
}

/**
 * Result of keyed token counting (for character fields, etc.)
 */
export interface KeyedTokenResult {
    key: string;
    tokens: number | null;
}

// =============================================================================
// STATE
// =============================================================================

const cache = new Map<string, number>();
const pending = new Map<string, PendingRequest>();

const DEBOUNCE_MS = 300;
const CACHE_MAX_SIZE = 500;

// =============================================================================
// CACHE KEY GENERATION
// =============================================================================

/**
 * Generate cache key from text using hash + length + bookends.
 */
function getCacheKey(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash | 0; // Convert to 32-bit integer
    }
    const prefix = text.slice(0, 16);
    const suffix = text.slice(-16);
    return `${hash}_${text.length}_${prefix}_${suffix}`;
}

// =============================================================================
// CALLBACK API (for UI with debounce)
// =============================================================================

/**
 * Get token count for text with debouncing and caching.
 * Best for UI where text is being typed.
 *
 * @example
 * ```ts
 * countTokensDebounced(textarea.value, (tokens) => {
 *     display.textContent = tokens !== null ? `${tokens} tokens` : '—';
 * });
 * ```
 */
export function countTokensDebounced(
    text: string,
    callback: TokenCallback,
    immediate = false,
): void {
    const trimmed = text.trim();

    if (!trimmed) {
        callback(0);
        return;
    }

    const key = getCacheKey(trimmed);

    // Check cache
    const cached = cache.get(key);
    if (cached !== undefined) {
        callback(cached);
        return;
    }

    // Check pending
    const existingPending = pending.get(key);
    if (existingPending) {
        existingPending.callbacks.push(callback);
        return;
    }

    // Create pending request
    const request: PendingRequest = {
        text: trimmed,
        callbacks: [callback],
        timeoutId: setTimeout(
            () => executeCount(key, trimmed),
            immediate ? 0 : DEBOUNCE_MS,
        ),
    };

    pending.set(key, request);
}

/**
 * Cancel pending count for specific text.
 */
export function cancelTokenCount(text: string): void {
    const key = getCacheKey(text.trim());
    const request = pending.get(key);
    if (request) {
        clearTimeout(request.timeoutId);
        pending.delete(key);
    }
}

/**
 * Cancel all pending token counts.
 */
export function cancelAllTokenCounts(): void {
    for (const request of pending.values()) {
        clearTimeout(request.timeoutId);
    }
    pending.clear();
}

/**
 * Clear token cache.
 * Call this when API/tokenizer changes.
 */
export function clearTokenCache(): void {
    cache.clear();
    log.debug('Token cache cleared');
}

// =============================================================================
// PROMISE API
// =============================================================================

/**
 * Get token count for text (Promise-based).
 * Uses cache, no debounce.
 */
export async function getTokenCount(text: string): Promise<number | null> {
    const trimmed = text.trim();
    if (!trimmed) return 0;

    const key = getCacheKey(trimmed);

    // Check cache
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    // Execute immediately
    const ctx = SillyTavern.getContext();
    if (typeof ctx.getTokenCountAsync !== 'function') {
        return null;
    }

    try {
        const tokens = await ctx.getTokenCountAsync(trimmed);
        setCacheValue(key, tokens);
        return tokens;
    } catch (e) {
        log.error('Token count failed', e);
        return null;
    }
}

/**
 * Get token counts for multiple texts in parallel.
 */
export async function getTokenCountBatch(
    texts: string[],
): Promise<Map<string, number | null>> {
    const results = new Map<string, number | null>();
    const uncached: Array<{ text: string; key: string; original: string }> = [];

    // Check cache first
    for (const text of texts) {
        const trimmed = text.trim();
        if (!trimmed) {
            results.set(text, 0);
            continue;
        }

        const key = getCacheKey(trimmed);
        const cached = cache.get(key);
        if (cached !== undefined) {
            results.set(text, cached);
        } else {
            uncached.push({ text: trimmed, key, original: text });
        }
    }

    // Fetch uncached in parallel
    if (uncached.length > 0) {
        const ctx = SillyTavern.getContext();
        if (typeof ctx.getTokenCountAsync !== 'function') {
            for (const { original } of uncached) {
                results.set(original, null);
            }
            return results;
        }

        const promises = uncached.map(async ({ text, key, original }) => {
            try {
                const tokens = await ctx.getTokenCountAsync(text);
                setCacheValue(key, tokens);
                return { original, tokens };
            } catch {
                return { original, tokens: null };
            }
        });

        const batchResults = await Promise.all(promises);
        for (const { original, tokens } of batchResults) {
            results.set(original, tokens);
        }
    }

    return results;
}

/**
 * Get token counts for keyed items (e.g., character fields).
 */
export async function getTokenCountsKeyed(
    items: Array<{ key: string; text: string }>,
): Promise<KeyedTokenResult[]> {
    const texts = items.map((i) => i.text);
    const counts = await getTokenCountBatch(texts);

    return items.map((item) => ({
        key: item.key,
        tokens: counts.get(item.text) ?? null,
    }));
}

// =============================================================================
// SYNC HELPERS
// =============================================================================

/**
 * Get cached token count if available (no API call).
 */
export function getCachedTokenCount(text: string): number | null {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    const key = getCacheKey(trimmed);
    return cache.get(key) ?? null;
}

/**
 * Check if a count is pending for this text.
 */
export function isTokenCountPending(text: string): boolean {
    const key = getCacheKey(text.trim());
    return pending.has(key);
}

/**
 * Manually set a cache value.
 */
export function setCachedTokenCount(text: string, count: number): void {
    const key = getCacheKey(text.trim());
    setCacheValue(key, count);
}

/**
 * Get current cache size.
 */
export function getTokenCacheSize(): number {
    return cache.size;
}

/**
 * Get pending request count.
 */
export function getTokenPendingCount(): number {
    return pending.size;
}

// =============================================================================
// INTERNAL
// =============================================================================

function setCacheValue(key: string, tokens: number): void {
    // Only evict if we're adding a NEW key and cache is full
    // Don't evict when updating an existing key
    if (!cache.has(key) && cache.size >= CACHE_MAX_SIZE) {
        const firstKey = cache.keys().next().value;
        if (firstKey) cache.delete(firstKey);
    }
    cache.set(key, tokens);
}

async function executeCount(key: string, text: string): Promise<void> {
    const request = pending.get(key);
    if (!request) return;

    pending.delete(key);

    const ctx = SillyTavern.getContext();

    if (typeof ctx.getTokenCountAsync !== 'function') {
        log.debug('Token counting not available');
        for (const cb of request.callbacks) {
            cb(null);
        }
        return;
    }

    try {
        const tokens = await ctx.getTokenCountAsync(text);
        setCacheValue(key, tokens);

        for (const cb of request.callbacks) {
            cb(tokens);
        }
    } catch (e) {
        log.error('Token count failed', e);
        for (const cb of request.callbacks) {
            cb(null);
        }
    }
}
