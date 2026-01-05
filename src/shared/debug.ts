// src/shared/debug.ts
// =============================================================================
// DEBUG LOGGING & DIAGNOSTICS
// =============================================================================
//
// Provides:
// - Prefixed logging with debug toggle
// - Log storage for later inspection (100 entries)
// - Diagnostics collection for bug reports
//
// =============================================================================

import { MODULE_NAME, VERSION, SETTINGS_VERSION } from './constants';

// =============================================================================
// CONFIGURATION
// =============================================================================

const MAX_LOG_ENTRIES = 100;

// =============================================================================
// TYPES
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    message: string;
    data?: unknown;
}

export interface DiagnosticInfo {
    extension: {
        name: string;
        version: string;
        settingsVersion: number;
        debugMode: boolean;
    };
    sillytavern: {
        mainApi: string;
        onlineStatus: string;
        currentModel: string;
        contextSize: number;
        maxOutput: number;
        characterCount: number;
        hasActiveChat: boolean;
        hasCMRS: boolean;
        hasGenerateRaw: boolean;
    };
    logs: {
        total: number;
        errors: number;
        recent: Array<{
            level: LogLevel;
            message: string;
            time: string;
        }>;
    };
    environment: {
        userAgent: string;
        timestamp: string;
    };
}

// =============================================================================
// STATE
// =============================================================================

const logEntries: LogEntry[] = [];
let debugEnabled = false;

// =============================================================================
// LOGGER INTERFACE
// =============================================================================

/**
 * Main logger object.
 *
 * @example
 * ```ts
 * import { log } from '../shared';
 *
 * log.info('Extension loaded');
 * log.debug('Processing', { items: 42 }); // Only logs if debug mode on
 * log.error('Failed to save', error);
 * ```
 */
export const log = {
    /**
     * Debug message (only logs if debug mode is enabled).
     * Always stored for later inspection.
     */
    debug(message: string, data?: unknown): void {
        addEntry('debug', message, data);
        if (debugEnabled) {
            if (data !== undefined) {
                console.debug(`[${MODULE_NAME}]`, message, data);
            } else {
                console.debug(`[${MODULE_NAME}]`, message);
            }
        }
    },

    /**
     * Info message (always logs to console).
     */
    info(message: string, data?: unknown): void {
        addEntry('info', message, data);
        if (data !== undefined) {
            console.log(`[${MODULE_NAME}]`, message, data);
        } else {
            console.log(`[${MODULE_NAME}]`, message);
        }
    },

    /**
     * Warning message (always logs to console).
     */
    warn(message: string, data?: unknown): void {
        addEntry('warn', message, data);
        if (data !== undefined) {
            console.warn(`[${MODULE_NAME}]`, message, data);
        } else {
            console.warn(`[${MODULE_NAME}]`, message);
        }
    },

    /**
     * Error message (always logs to console).
     */
    error(message: string, data?: unknown): void {
        addEntry('error', message, data);
        if (data !== undefined) {
            console.error(`[${MODULE_NAME}]`, message, data);
        } else {
            console.error(`[${MODULE_NAME}]`, message);
        }
    },
};

// =============================================================================
// DEBUG MODE
// =============================================================================

/**
 * Check if debug mode is enabled.
 */
export function isDebugMode(): boolean {
    return debugEnabled;
}

/**
 * Set debug mode.
 */
export function setDebugMode(enabled: boolean): void {
    debugEnabled = enabled;
    log.info(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
}

// =============================================================================
// LOG STORAGE
// =============================================================================

function addEntry(level: LogLevel, message: string, data?: unknown): void {
    logEntries.unshift({
        timestamp: new Date(),
        level,
        message,
        data,
    });

    if (logEntries.length > MAX_LOG_ENTRIES) {
        logEntries.pop();
    }
}

/**
 * Get all stored log entries.
 */
export function getLogEntries(): LogEntry[] {
    return [...logEntries];
}

/**
 * Get log entries filtered by level.
 */
export function getLogEntriesByLevel(level: LogLevel): LogEntry[] {
    return logEntries.filter((e) => e.level === level);
}

/**
 * Clear all stored log entries.
 */
export function clearLogEntries(): void {
    logEntries.length = 0;
}

// =============================================================================
// DIAGNOSTICS
// =============================================================================

/**
 * Safely get current model from ST context.
 */
function safeGetCurrentModel(): string {
    try {
        const context = SillyTavern.getContext();

        if (context.mainApi === 'textgenerationwebui') {
            return context.onlineStatus || 'unknown';
        }

        if (typeof context.getChatCompletionModel === 'function') {
            return context.getChatCompletionModel() || 'unknown';
        }

        const ccs = context.chatCompletionSettings;
        if (!ccs) return 'unknown';

        const source = ccs.chat_completion_source || 'unknown';
        const modelKey =
            source === 'makersuite' ? 'google_model' : `${source}_model`;
        return (
            ((ccs as Record<string, unknown>)[modelKey] as string) || 'unknown'
        );
    } catch {
        return 'unknown';
    }
}

/**
 * Collect diagnostic information for debugging/bug reports.
 */
export function collectDiagnostics(): DiagnosticInfo {
    const context = SillyTavern.getContext();
    const ccs = context.chatCompletionSettings;

    return {
        extension: {
            name: MODULE_NAME,
            version: VERSION,
            settingsVersion: SETTINGS_VERSION,
            debugMode: debugEnabled,
        },
        sillytavern: {
            mainApi: context.mainApi ?? 'unknown',
            onlineStatus: context.onlineStatus ?? 'unknown',
            currentModel: safeGetCurrentModel(),
            contextSize: ccs?.openai_max_context ?? context.maxContext ?? 0,
            maxOutput: ccs?.openai_max_tokens ?? 0,
            characterCount: context.characters?.length ?? 0,
            hasActiveChat: !!context.chat?.length,
            hasCMRS: !!context.ConnectionManagerRequestService,
            hasGenerateRaw: typeof context.generateRaw === 'function',
        },
        logs: {
            total: logEntries.length,
            errors: logEntries.filter((e) => e.level === 'error').length,
            recent: logEntries.slice(0, 10).map((e) => ({
                level: e.level,
                message: e.message,
                time: e.timestamp.toISOString(),
            })),
        },
        environment: {
            userAgent:
                typeof navigator !== 'undefined'
                    ? navigator.userAgent
                    : 'unknown',
            timestamp: new Date().toISOString(),
        },
    };
}

/**
 * Export diagnostics as JSON string.
 */
export function exportDiagnostics(): string {
    return JSON.stringify(collectDiagnostics(), null, 2);
}

/**
 * Generate a formatted debug report for bug reports.
 */
export function generateDebugReport(): string {
    const info = collectDiagnostics();
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push(`${MODULE_NAME.toUpperCase()} DEBUG REPORT`);
    lines.push('='.repeat(60));
    lines.push('');

    lines.push('## Extension');
    lines.push(`Name: ${info.extension.name}`);
    lines.push(`Version: ${info.extension.version}`);
    lines.push(`Settings Version: ${info.extension.settingsVersion}`);
    lines.push(`Debug Mode: ${info.extension.debugMode ? 'On' : 'Off'}`);
    lines.push('');

    lines.push('## SillyTavern');
    lines.push(`Main API: ${info.sillytavern.mainApi}`);
    lines.push(`Online Status: ${info.sillytavern.onlineStatus}`);
    lines.push(`Current Model: ${info.sillytavern.currentModel}`);
    lines.push(`Context Size: ${info.sillytavern.contextSize}`);
    lines.push(`Max Output: ${info.sillytavern.maxOutput}`);
    lines.push(`Characters: ${info.sillytavern.characterCount}`);
    lines.push(
        `Has Active Chat: ${info.sillytavern.hasActiveChat ? 'Yes' : 'No'}`,
    );
    lines.push('');
    lines.push('API Availability:');
    lines.push(`  CMRS: ${info.sillytavern.hasCMRS ? '✅' : '❌'}`);
    lines.push(
        `  generateRaw: ${info.sillytavern.hasGenerateRaw ? '✅' : '❌'}`,
    );
    lines.push('');

    lines.push('## Recent Logs');
    lines.push(`Total: ${info.logs.total} (${info.logs.errors} errors)`);
    if (info.logs.recent.length > 0) {
        for (const entry of info.logs.recent) {
            const icon =
                entry.level === 'error'
                    ? '❌'
                    : entry.level === 'warn'
                      ? '⚠️'
                      : 'ℹ️';
            lines.push(`  ${icon} [${entry.time}] ${entry.message}`);
        }
    } else {
        lines.push('  No recent logs');
    }
    lines.push('');

    lines.push('## Environment');
    lines.push(`Generated: ${info.environment.timestamp}`);
    lines.push(`User Agent: ${info.environment.userAgent}`);
    lines.push('');

    lines.push('='.repeat(60));

    return lines.join('\n');
}
