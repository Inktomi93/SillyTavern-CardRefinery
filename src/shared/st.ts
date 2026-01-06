// src/shared/st.ts
// =============================================================================
// SILLYTAVERN API - MINIMAL WRAPPERS
// =============================================================================
//
// This file contains ONLY wrappers that add genuine value beyond raw ST APIs:
// - Namespaced utilities (popup, toast) to avoid window shadowing
// - Factory functions that return managed objects (settings, events, metadata)
// - Storage helpers with error handling
//
// For everything else, use ST APIs directly:
//   const context = SillyTavern.getContext();
//   const { lodash, DOMPurify, Fuse } = SillyTavern.libs;
//
// DOCS: https://docs.sillytavern.app/for-contributors/writing-extensions/
// =============================================================================

import { log } from './debug';

// =============================================================================
// POPUP NAMESPACE
// =============================================================================

/**
 * Popup utilities - namespaced to avoid shadowing window.alert/confirm.
 *
 * @example
 * ```ts
 * if (await popup.confirm('Delete?', 'Are you sure?')) {
 *     deleteItem();
 * }
 * ```
 */
export const popup = {
    async confirm(title: string, message: string): Promise<boolean> {
        const result = await SillyTavern.getContext().Popup.show.confirm(
            title,
            message,
        );
        // ST popup returns true or 1 for confirm, false/undefined/0 for cancel
        return result === true || result === 1;
    },

    async input(
        title: string,
        message: string,
        defaultValue?: string,
    ): Promise<string | null> {
        return SillyTavern.getContext().Popup.show.input(
            title,
            message,
            defaultValue,
        );
    },

    async alert(title: string, message: string): Promise<void> {
        await SillyTavern.getContext().Popup.show.text(title, message);
    },
};

// =============================================================================
// TOAST NAMESPACE
// =============================================================================

/**
 * Toast notification utilities.
 * Uses ST's global toastr for user feedback.
 *
 * @example
 * ```ts
 * toast.success('Settings saved');
 * toast.error('Failed to load character');
 * ```
 */
export const toast = {
    success(message: string, title?: string): void {
        toastr.success(message, title);
    },
    error(message: string, title?: string): void {
        toastr.error(message, title);
    },
    warning(message: string, title?: string): void {
        toastr.warning(message, title);
    },
    info(message: string, title?: string): void {
        toastr.info(message, title);
    },
};

// =============================================================================
// SETTINGS MANAGER
// =============================================================================

/**
 * Create a settings manager for your extension.
 *
 * Handles initialization, defaults merging, and persistence via ST's
 * extensionSettings system.
 *
 * @example
 * ```ts
 * const settings = createSettingsManager('my-ext', {
 *     enabled: true,
 *     threshold: 0.5,
 * });
 *
 * const current = settings.get();
 * current.threshold = 0.8;
 * settings.save();
 * ```
 */
export function createSettingsManager<
    TName extends string,
    T extends Record<string, unknown>,
>(
    moduleName: TName,
    defaultSettings: T,
): {
    get: () => T;
    save: () => void;
    reset: () => T;
    readonly moduleName: TName;
} {
    const { lodash } = SillyTavern.libs;
    const frozen = Object.freeze(lodash.cloneDeep(defaultSettings));

    return {
        moduleName,

        get(): T {
            const ext = SillyTavern.getContext().extensionSettings;

            if (!ext[moduleName]) {
                ext[moduleName] = lodash.cloneDeep(frozen);
            }

            // Merge any missing keys from defaults
            for (const key of Object.keys(frozen)) {
                if (!(key in ext[moduleName])) {
                    ext[moduleName][key] = (frozen as Record<string, unknown>)[
                        key
                    ];
                }
            }

            return ext[moduleName] as T;
        },

        save(): void {
            SillyTavern.getContext().saveSettingsDebounced();
        },

        reset(): T {
            const ext = SillyTavern.getContext().extensionSettings;
            ext[moduleName] = lodash.cloneDeep(frozen);
            SillyTavern.getContext().saveSettingsDebounced();
            return ext[moduleName] as T;
        },
    };
}

// =============================================================================
// EVENT MANAGER
// =============================================================================

/**
 * Create an event manager that tracks listeners for cleanup.
 *
 * ST's eventSource doesn't track listeners per-extension, so this wrapper
 * ensures you can clean up all your listeners when your popup closes.
 *
 * @example
 * ```ts
 * const events = createEventManager();
 *
 * // Register listeners
 * events.on(eventTypes.CHAT_CHANGED, handleChatChange);
 * events.on(eventTypes.MESSAGE_RECEIVED, handleMessage);
 *
 * // On popup close, clean up everything
 * events.cleanup();
 * ```
 */
export function createEventManager(): {
    on: (
        eventType: string,
        handler: (...args: unknown[]) => void,
    ) => () => void;
    once: (
        eventType: string,
        handler: (...args: unknown[]) => void,
    ) => () => void;
    off: (eventType: string, handler: (...args: unknown[]) => void) => void;
    cleanup: () => void;
    listenerCount: () => number;
} {
    const listeners: Array<{
        type: string;
        handler: (...args: unknown[]) => void;
    }> = [];
    const { eventSource } = SillyTavern.getContext();

    const manager = {
        on(
            eventType: string,
            handler: (...args: unknown[]) => void,
        ): () => void {
            eventSource.on(eventType, handler);
            listeners.push({ type: eventType, handler });
            return () => manager.off(eventType, handler);
        },

        once(
            eventType: string,
            handler: (...args: unknown[]) => void,
        ): () => void {
            const wrapper = (...args: unknown[]) => {
                manager.off(eventType, wrapper);
                handler(...args);
            };
            return manager.on(eventType, wrapper);
        },

        off(eventType: string, handler: (...args: unknown[]) => void): void {
            eventSource.removeListener(eventType, handler);
            const index = listeners.findIndex(
                (l) => l.type === eventType && l.handler === handler,
            );
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        },

        cleanup(): void {
            for (const { type, handler } of listeners) {
                eventSource.removeListener(type, handler);
            }
            listeners.length = 0;
        },

        listenerCount(): number {
            return listeners.length;
        },
    };

    return manager;
}

// =============================================================================
// LOADER UTILITIES
// =============================================================================

/**
 * Show the global loading indicator.
 * Use during long-running operations like LLM generation.
 *
 * @example
 * ```ts
 * loader.show();
 * try {
 *     await generateResponse();
 * } finally {
 *     loader.hide();
 * }
 * ```
 */
export const loader = {
    show(): void {
        const ctx = SillyTavern.getContext();
        if (typeof ctx.showLoader === 'function') {
            ctx.showLoader();
        }
    },

    hide(): void {
        const ctx = SillyTavern.getContext();
        if (typeof ctx.hideLoader === 'function') {
            ctx.hideLoader();
        }
    },

    /**
     * Wrap an async operation with loader display.
     */
    async wrap<T>(operation: () => Promise<T>): Promise<T> {
        loader.show();
        try {
            return await operation();
        } finally {
            loader.hide();
        }
    },
};

// =============================================================================
// LARGE DATA STORAGE (LocalForage)
// =============================================================================

/**
 * Store large data in IndexedDB via localforage.
 *
 * Use this for session data, caches, etc. that are too large for
 * extensionSettings (which goes in settings.json).
 */
export async function storeLargeData(
    key: string,
    data: unknown,
): Promise<boolean> {
    try {
        await SillyTavern.libs.localforage.setItem(key, data);
        return true;
    } catch (e) {
        log.error(`storeLargeData: Failed to store ${key}:`, e);
        return false;
    }
}

/**
 * Load large data from IndexedDB.
 */
export async function loadLargeData<T = unknown>(
    key: string,
): Promise<T | null> {
    try {
        return await SillyTavern.libs.localforage.getItem<T>(key);
    } catch (e) {
        log.error(`loadLargeData: Failed to load ${key}:`, e);
        return null;
    }
}

// =============================================================================
// CHARACTER API
// =============================================================================

/**
 * Edit a single character attribute via ST API.
 *
 * @example
 * ```ts
 * await editCharacterAttribute(avatarUrl, charName, 'description', 'New desc');
 * ```
 */
export async function editCharacterAttribute(
    avatarUrl: string,
    charName: string,
    field: string,
    value: string | string[],
): Promise<boolean> {
    const ctx = SillyTavern.getContext();

    try {
        const response = await fetch('/api/characters/edit-attribute', {
            method: 'POST',
            headers: ctx.getRequestHeaders(),
            body: JSON.stringify({
                avatar_url: avatarUrl,
                ch_name: charName,
                field,
                value,
            }),
        });

        return response.ok;
    } catch (error) {
        log.error(`Failed to edit attribute ${field}:`, error);
        return false;
    }
}

/**
 * Get character JSON data via ST export API.
 *
 * @example
 * ```ts
 * const charJson = await getCharacterJson(avatarUrl);
 * ```
 */
export async function getCharacterJson(
    avatarUrl: string,
): Promise<Record<string, unknown> | null> {
    const ctx = SillyTavern.getContext();

    try {
        const response = await fetch('/api/characters/export', {
            method: 'POST',
            headers: ctx.getRequestHeaders(),
            body: JSON.stringify({
                avatar_url: avatarUrl,
                format: 'json',
            }),
        });

        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        log.error('Failed to get character JSON:', error);
        return null;
    }
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

// Re-export commonly needed types derived from ST context
export type STContext = ReturnType<typeof SillyTavern.getContext>;
export type STCharacter = STContext['characters'][number];
export type STMessage = STContext['chat'][number];
export type STEventTypes = STContext['eventTypes'];

// Manager types
export type SettingsManager<T extends Record<string, unknown>> = ReturnType<
    typeof createSettingsManager<string, T>
>;
export type EventManager = ReturnType<typeof createEventManager>;

// =============================================================================
// STRUCTURED OUTPUT TYPES
// =============================================================================

/**
 * Structured output JSON schema format.
 * @see https://docs.sillytavern.app/for-contributors/writing-extensions/#structured-output
 */
export interface StructuredOutputSchema {
    name: string;
    strict?: boolean;
    value: JsonSchemaValue;
}

export interface JsonSchemaValue {
    type?: string;
    properties?: Record<string, JsonSchemaValue>;
    required?: string[];
    additionalProperties?: boolean;
    items?: JsonSchemaValue;
    enum?: Array<string | number | boolean | null>;
    anyOf?: JsonSchemaValue[];
    allOf?: JsonSchemaValue[];
    $ref?: string;
    $defs?: Record<string, JsonSchemaValue>;
    definitions?: Record<string, JsonSchemaValue>;
    description?: string;
    format?: string;
    pattern?: string;
    minItems?: number;
    const?: unknown;
    [key: string]: unknown;
}
