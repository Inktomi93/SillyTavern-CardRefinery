// src/shared/profiles.ts
// =============================================================================
// API STATUS & CONNECTION PROFILES
// =============================================================================
//
// This is the SINGLE source for API status checking.
// Provides:
// - Connection Manager (CMRS) profile utilities
// - Current API status and readiness checking
// - Sampler settings access
//
// =============================================================================

import { log } from './debug';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Information about an available connection profile.
 */
export interface ProfileInfo {
    id: string;
    name: string;
    model: string;
    api: string;
    mode: 'cc' | 'tc';
    presetName: string;
    isSupported: boolean;
    validationError: string | null;
}

/**
 * Current API status information.
 */
export interface ApiStatus {
    /** Generation mode: 'current' uses ST settings, 'profile' uses CMRS */
    mode: 'current' | 'profile';
    /** Display name for UI */
    displayName: string;
    /** API source (e.g., 'openai', 'anthropic') */
    source: string;
    /** Model name */
    model: string;
    /** Short model display name */
    modelDisplay: string;
    /** API type */
    apiType: 'cc' | 'tc';
    /** Available context size */
    contextSize: number;
    /** Max output tokens */
    maxOutput: number;
    /** Whether API is ready for generation */
    isReady: boolean;
    /** Human-readable status */
    statusText: string;
    /** Error message if not ready */
    error: string | null;
}

// =============================================================================
// PROFILE DISCOVERY
// =============================================================================

/**
 * Check if CMRS (Connection Manager) is available.
 */
export function hasCMRS(): boolean {
    const ctx = SillyTavern.getContext();
    const cmrs = ctx.ConnectionManagerRequestService;
    return !!(cmrs && typeof cmrs.sendRequest === 'function');
}

/**
 * Get all available connection profiles from CMRS.
 */
export function getAvailableProfiles(): ProfileInfo[] {
    const ctx = SillyTavern.getContext();
    const cmrs = ctx.ConnectionManagerRequestService;

    if (!cmrs || typeof cmrs.getSupportedProfiles !== 'function') {
        return [];
    }

    try {
        const profiles = cmrs.getSupportedProfiles() || [];

        return profiles.map(
            (p: {
                id: string;
                name: string;
                model: string;
                api: string;
                mode: 'cc' | 'tc';
                presetName: string;
            }) => {
                const validation = validateProfile(p.id, cmrs);

                return {
                    id: p.id,
                    name: p.name,
                    model: p.model,
                    api: p.api,
                    mode: p.mode,
                    presetName: p.presetName,
                    isSupported: validation.valid,
                    validationError: validation.error,
                };
            },
        );
    } catch (e) {
        log.error('Failed to get profiles', e);
        return [];
    }
}

/**
 * Get a specific profile by ID.
 */
export function getProfile(profileId: string): ProfileInfo | null {
    const profiles = getAvailableProfiles();
    return profiles.find((p) => p.id === profileId) || null;
}

/**
 * Check if a profile ID is valid and usable.
 */
export function isProfileValid(profileId: string): boolean {
    const profile = getProfile(profileId);
    return profile?.isSupported ?? false;
}

function validateProfile(
    profileId: string,
    cmrs: NonNullable<
        ReturnType<
            typeof SillyTavern.getContext
        >['ConnectionManagerRequestService']
    >,
): { valid: boolean; error: string | null } {
    try {
        const profiles = cmrs.getSupportedProfiles() || [];
        const profile = profiles.find(
            (p: { id: string }) => p.id === profileId,
        );

        if (!profile) {
            return { valid: false, error: 'Profile not found' };
        }

        return { valid: true, error: null };
    } catch {
        return { valid: false, error: 'Failed to validate profile' };
    }
}

// =============================================================================
// API STATUS (SINGLE SOURCE OF TRUTH)
// =============================================================================

/**
 * Get current API status.
 *
 * This is THE function to use for checking API readiness.
 *
 * @param profileId - Optional profile ID. If not provided, uses current ST settings.
 *
 * @example
 * ```ts
 * const status = getApiStatus();
 * if (!status.isReady) {
 *     toast.error(status.error || 'API not ready');
 *     return;
 * }
 * console.log(`Using ${status.model} with ${status.contextSize} context`);
 * ```
 */
export function getApiStatus(profileId?: string | null): ApiStatus {
    const ctx = SillyTavern.getContext();

    if (profileId) {
        return getProfileApiStatus(profileId);
    }

    return getCurrentApiStatus(ctx);
}

/**
 * Quick check if API is ready for generation.
 */
export function isApiReady(profileId?: string | null): boolean {
    return getApiStatus(profileId).isReady;
}

function getCurrentApiStatus(
    ctx: ReturnType<typeof SillyTavern.getContext>,
): ApiStatus {
    const mainApi = ctx.mainApi ?? 'unknown';
    const ccs = ctx.chatCompletionSettings;
    const tcs = ctx.textCompletionSettings;

    const isChatCompletion =
        mainApi !== 'textgenerationwebui' && mainApi !== 'kobold';
    const apiType: 'cc' | 'tc' = isChatCompletion ? 'cc' : 'tc';

    // Get model name
    let model = 'unknown';
    if (isChatCompletion && typeof ctx.getChatCompletionModel === 'function') {
        model = ctx.getChatCompletionModel() || 'unknown';
    } else if (!isChatCompletion) {
        model = ctx.onlineStatus || 'unknown';
    }

    // Get source
    let source = mainApi;
    if (isChatCompletion && ccs?.chat_completion_source) {
        source = ccs.chat_completion_source;
    }

    // Get context and output limits
    const contextSize = ccs?.openai_max_context ?? ctx.maxContext ?? 8192;
    const maxOutput = isChatCompletion
        ? (ccs?.openai_max_tokens ?? 4096)
        : (tcs?.max_length ?? 2048);

    // Check readiness
    const { isReady, error } = checkApiReadiness(ctx);

    return {
        mode: 'current',
        displayName: 'Current Settings',
        source,
        model,
        modelDisplay: formatModelName(model),
        apiType,
        contextSize,
        maxOutput,
        isReady,
        statusText: isReady ? `${formatModelName(model)} Ready` : 'Not Ready',
        error,
    };
}

function getProfileApiStatus(profileId: string): ApiStatus {
    const profile = getProfile(profileId);

    if (!profile) {
        return {
            mode: 'profile',
            displayName: 'Unknown Profile',
            source: 'unknown',
            model: 'unknown',
            modelDisplay: 'Unknown',
            apiType: 'cc',
            contextSize: 8192,
            maxOutput: 4096,
            isReady: false,
            statusText: 'Profile Not Found',
            error: `Profile ${profileId} not found`,
        };
    }

    return {
        mode: 'profile',
        displayName: profile.name,
        source: profile.api,
        model: profile.model,
        modelDisplay: formatModelName(profile.model),
        apiType: profile.mode,
        contextSize: 8192,
        maxOutput: 4096,
        isReady: profile.isSupported,
        statusText: profile.isSupported
            ? `${profile.name} Ready`
            : 'Not Supported',
        error: profile.validationError,
    };
}

function checkApiReadiness(ctx: ReturnType<typeof SillyTavern.getContext>): {
    isReady: boolean;
    error: string | null;
} {
    const ccs = ctx.chatCompletionSettings;
    if (ccs?.bypass_status_check) {
        return { isReady: true, error: null };
    }

    const status = (ctx.onlineStatus ?? '').toLowerCase();

    if (!status) {
        return { isReady: false, error: 'No API connection' };
    }

    const errorPatterns = [
        'error',
        'fail',
        'invalid',
        'unauthorized',
        'missing',
    ];
    if (errorPatterns.some((p) => status.includes(p))) {
        return { isReady: false, error: `API error: ${status}` };
    }

    const successPatterns = [
        'valid',
        'connected',
        'ok',
        'ready',
        'key',
        'saved',
    ];
    if (successPatterns.some((p) => status.includes(p))) {
        return { isReady: true, error: null };
    }

    if (typeof ctx.generateRaw !== 'function') {
        return {
            isReady: false,
            error: 'Generation not available (ST version?)',
        };
    }

    return { isReady: true, error: null };
}

function formatModelName(model: string): string {
    if (!model || model === 'unknown') return 'Unknown';

    const cleaned = model
        .replace(/^gpt-/, 'GPT-')
        .replace(/^claude-/, 'Claude-')
        .replace(/^gemini-/, 'Gemini-')
        .replace(/-\d{4}-\d{2}-\d{2}$/, '')
        .replace(/-preview$/, '');

    if (cleaned.length > 30) {
        return cleaned.slice(0, 27) + '...';
    }

    return cleaned;
}
