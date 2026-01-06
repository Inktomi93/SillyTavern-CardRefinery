// src/domain/generation.ts
// =============================================================================
// GENERATION UTILITIES
// =============================================================================
//
// Higher-level generation utilities built on top of ST's generateRaw.
// Provides:
// - Error categorization with user-friendly messages
// - Abort signal handling
// - Retry logic for transient failures
// - Structured output support
//
// For API status, use getApiStatus() from shared/profiles.ts.
// For token estimation, use estimateTokens() from shared/profiles.ts.
//
// =============================================================================

import { isApiReady, getApiStatus } from '../shared';
import type { StructuredOutputSchema } from '../shared';
import { validateSchema, parseStructuredResponse } from './schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options for raw generation.
 */
export interface GenerateOptions {
    /** User prompt */
    prompt: string;
    /** System prompt (optional) */
    systemPrompt?: string;
    /** Max response tokens (null = use ST settings) */
    responseLength?: number | null;
    /** JSON schema for structured output */
    jsonSchema?: StructuredOutputSchema | null;
    /** Abort signal for cancellation */
    signal?: AbortSignal;
}

/**
 * Result from a generation request.
 */
export interface GenerationResult {
    /** Whether generation succeeded */
    success: boolean;
    /** Response text (if successful) */
    response?: string;
    /** Parsed structured data (if using jsonSchema) */
    parsed?: unknown;
    /** Error message (if failed) */
    error?: string;
    /** Whether the response was structured output */
    isStructured?: boolean;
}

// =============================================================================
// MAIN GENERATION FUNCTION
// =============================================================================

/**
 * Generate text with comprehensive error handling.
 *
 * @example
 * ```ts
 * const result = await generate({
 *     prompt: 'Analyze this character...',
 *     systemPrompt: 'You are a character analyst.',
 * });
 *
 * if (!result.success) {
 *     toast.error(result.error);
 *     return;
 * }
 *
 * console.log(result.response);
 * ```
 */
export async function generate(
    options: GenerateOptions,
): Promise<GenerationResult> {
    // Check abort before starting
    if (options.signal?.aborted) {
        return { success: false, error: 'Generation cancelled' };
    }

    // Check API readiness
    if (!isApiReady()) {
        const status = getApiStatus();
        return {
            success: false,
            error:
                status.error ||
                'API not connected. Check your connection settings.',
        };
    }

    // Validate schema if provided
    if (options.jsonSchema) {
        const validation = validateSchema(options.jsonSchema);
        if (!validation.valid) {
            return {
                success: false,
                error: `Invalid schema: ${validation.error}`,
            };
        }
    }

    try {
        // Check abort again before API call
        if (options.signal?.aborted) {
            return { success: false, error: 'Generation cancelled' };
        }

        const ctx = SillyTavern.getContext();
        const response = await ctx.generateRaw({
            prompt: options.prompt,
            systemPrompt: options.systemPrompt ?? '',
            responseLength: options.responseLength ?? null,
            jsonSchema: options.jsonSchema ?? null,
        });

        // Check abort after API call
        if (options.signal?.aborted) {
            return { success: false, error: 'Generation cancelled' };
        }

        // Normalize response to string
        const responseText = normalizeResponse(response);

        // Handle empty response
        if (!responseText || responseText.trim() === '') {
            return { success: false, error: 'Empty response from API' };
        }

        // Parse structured output if schema was provided
        if (options.jsonSchema) {
            const parsed = parseStructuredResponse(
                responseText,
                options.jsonSchema,
            );
            if (parsed) {
                return {
                    success: true,
                    response: responseText,
                    parsed: parsed.data,
                    isStructured: true,
                };
            }
            // Parsing failed but we still have text
            return {
                success: true,
                response: responseText,
                isStructured: false,
            };
        }

        return {
            success: true,
            response: responseText,
            isStructured: false,
        };
    } catch (err) {
        return categorizeError(err);
    }
}

/**
 * Normalize various response types to string.
 */
function normalizeResponse(response: unknown): string {
    if (typeof response === 'string') return response;
    if (response === null || response === undefined) return '';
    if (typeof response === 'object') {
        const obj = response as Record<string, unknown>;
        if (typeof obj.text === 'string') return obj.text;
        if (typeof obj.content === 'string') return obj.content;
        return JSON.stringify(response);
    }
    return String(response);
}

// =============================================================================
// ERROR CATEGORIZATION
// =============================================================================

/**
 * Categorize an error into a user-friendly message.
 */
function categorizeError(err: unknown): GenerationResult {
    if ((err as Error).name === 'AbortError') {
        return { success: false, error: 'Generation cancelled' };
    }

    const message = err instanceof Error ? err.message : String(err);
    const lower = message.toLowerCase();

    // Authentication
    if (
        lower.includes('401') ||
        lower.includes('unauthorized') ||
        lower.includes('invalid_api_key') ||
        lower.includes('api key')
    ) {
        return {
            success: false,
            error: 'API authentication failed. Check your API key.',
        };
    }

    // Rate limiting
    if (lower.includes('429') || lower.includes('rate limit')) {
        return {
            success: false,
            error: 'Rate limited. Please wait and try again.',
        };
    }

    // Server errors
    if (
        lower.includes('500') ||
        lower.includes('502') ||
        lower.includes('503')
    ) {
        return {
            success: false,
            error: 'API server error. The service may be temporarily unavailable.',
        };
    }

    // Timeout
    if (lower.includes('timeout') || lower.includes('etimedout')) {
        return {
            success: false,
            error: 'Request timed out. Check your connection or try a different model.',
        };
    }

    // Network
    if (
        lower.includes('network') ||
        lower.includes('econnrefused') ||
        lower.includes('fetch failed')
    ) {
        return {
            success: false,
            error: 'Network error. Check your internet connection.',
        };
    }

    // Context length
    if (
        lower.includes('context') ||
        lower.includes('too long') ||
        lower.includes('maximum context') ||
        lower.includes('token')
    ) {
        return {
            success: false,
            error: 'Prompt too long for model context. Try reducing input length.',
        };
    }

    // Model not found
    if (
        lower.includes('model') &&
        (lower.includes('not found') || lower.includes('does not exist'))
    ) {
        return {
            success: false,
            error: 'Model not found. It may have been deprecated or renamed.',
        };
    }

    // Content filter
    if (
        lower.includes('content') &&
        (lower.includes('filter') || lower.includes('policy'))
    ) {
        return {
            success: false,
            error: 'Content was filtered by the API. Try rephrasing your prompt.',
        };
    }

    // Default
    return { success: false, error: message };
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Generate with a simple string prompt.
 */
export async function generateSimple(
    prompt: string,
    systemPrompt?: string,
): Promise<string | null> {
    const result = await generate({ prompt, systemPrompt });
    return result.success ? (result.response ?? null) : null;
}

// =============================================================================
// NOTE ON API STATUS FUNCTIONS
// =============================================================================
//
// API status functions (getApiStatus, isApiReady, estimateTokens, promptFitsContext)
// live in shared/profiles.ts. Import them directly from '../shared' rather than
// from this module to maintain clear layer separation.
//
// Previous versions re-exported them here for convenience, but this obscured
// the actual source and confused layer boundaries.
//
