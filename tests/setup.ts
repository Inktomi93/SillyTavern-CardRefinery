/**
 * Vitest Setup - SillyTavern Mock Environment
 *
 * This file creates a minimal mock of SillyTavern's global APIs,
 * allowing tests to run without the actual ST runtime.
 */

import { vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// MOCK DATA FACTORIES
// =============================================================================

export function createMockCharacter(
    overrides: Partial<MockCharacter> = {},
): MockCharacter {
    return {
        name: 'Test Character',
        avatar: 'test.png',
        description: 'A test character for unit testing.',
        personality: 'Helpful and friendly.',
        scenario: 'Testing scenario.',
        first_mes: 'Hello, I am a test character.',
        mes_example: '<START>\n{{user}}: Hi\n{{char}}: Hello!',
        system_prompt: '',
        post_history_instructions: '',
        creator_notes: '',
        tags: [],
        ...overrides,
    };
}

export interface MockCharacter {
    name: string;
    avatar: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    system_prompt: string;
    post_history_instructions: string;
    creator_notes: string;
    tags: string[];
}

// =============================================================================
// SILLYTAVERN GLOBAL MOCK
// =============================================================================

interface MockSTContext {
    extensionSettings: Record<string, unknown>;
    characters: MockCharacter[];
    chat: unknown[];
    chatMetadata: Record<string, unknown>;
    eventTypes: Record<string, string>;
    eventSource: MockEventEmitter;
    Popup: MockPopup;
    saveSettingsDebounced: () => void;
    saveMetadata: () => Promise<void>;
    showLoader: () => void;
    hideLoader: () => void;
}

interface MockEventEmitter {
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener: (
        event: string,
        handler: (...args: unknown[]) => void,
    ) => void;
    emit: (event: string, ...args: unknown[]) => void;
}

interface MockPopup {
    show: {
        confirm: (title: string, message: string) => Promise<boolean>;
        input: (
            title: string,
            message: string,
            defaultValue?: string,
        ) => Promise<string | null>;
        text: (title: string, message: string) => Promise<void>;
    };
}

function createMockEventEmitter(): MockEventEmitter {
    const listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

    return {
        on(event, handler) {
            if (!listeners.has(event)) {
                listeners.set(event, new Set());
            }
            listeners.get(event)!.add(handler);
        },
        removeListener(event, handler) {
            listeners.get(event)?.delete(handler);
        },
        emit(event, ...args) {
            listeners.get(event)?.forEach((handler) => handler(...args));
        },
    };
}

function createMockContext(): MockSTContext {
    return {
        extensionSettings: {},
        characters: [createMockCharacter()],
        chat: [],
        chatMetadata: {},
        eventTypes: {
            APP_READY: 'app_ready',
            CHAT_CHANGED: 'chat_changed',
            CHARACTER_EDITED: 'character_edited',
        },
        eventSource: createMockEventEmitter(),
        Popup: {
            show: {
                confirm: vi.fn().mockResolvedValue(true),
                input: vi.fn().mockResolvedValue('test input'),
                text: vi.fn().mockResolvedValue(undefined),
            },
        },
        saveSettingsDebounced: vi.fn(),
        saveMetadata: vi.fn().mockResolvedValue(undefined),
        showLoader: vi.fn(),
        hideLoader: vi.fn(),
    };
}

// Shared context instance - reset between tests
let mockContext: MockSTContext;

// Create mock lodash with essential functions
const mockLodash = {
    cloneDeep: <T>(obj: T): T => JSON.parse(JSON.stringify(obj)),
    merge: <T extends object>(target: T, ...sources: Partial<T>[]): T => {
        return Object.assign({}, target, ...sources);
    },
    debounce: <T extends (...args: unknown[]) => unknown>(
        fn: T,
    ): T & { cancel: () => void; flush: () => void } => {
        const debounced = fn as T & { cancel: () => void; flush: () => void };
        debounced.cancel = () => {};
        debounced.flush = () => {};
        return debounced;
    },
    throttle: <T extends (...args: unknown[]) => unknown>(
        fn: T,
    ): T & { cancel: () => void } => {
        const throttled = fn as T & { cancel: () => void };
        throttled.cancel = () => {};
        return throttled;
    },
    get: (obj: unknown, path: string, defaultValue?: unknown): unknown => {
        const keys = path.split('.');
        let result: unknown = obj;
        for (const key of keys) {
            if (result == null) return defaultValue;
            result = (result as Record<string, unknown>)[key];
        }
        return result ?? defaultValue;
    },
    set: (obj: unknown, path: string, value: unknown): unknown => {
        const keys = path.split('.');
        let current = obj as Record<string, unknown>;
        for (let i = 0; i < keys.length - 1; i++) {
            if (current[keys[i]] == null) {
                current[keys[i]] = {};
            }
            current = current[keys[i]] as Record<string, unknown>;
        }
        current[keys[keys.length - 1]] = value;
        return obj;
    },
    isEqual: (a: unknown, b: unknown): boolean =>
        JSON.stringify(a) === JSON.stringify(b),
    isEmpty: (obj: unknown): boolean => {
        if (obj == null) return true;
        if (Array.isArray(obj)) return obj.length === 0;
        if (typeof obj === 'object') return Object.keys(obj).length === 0;
        return false;
    },
};

// Create mock DOMPurify
const mockDOMPurify = {
    sanitize: (html: string): string => html, // Pass-through for tests
    setConfig: vi.fn(),
    clearConfig: vi.fn(),
    isSupported: true,
};

// Create mock localforage
const localforageStore = new Map<string, unknown>();
const mockLocalforage = {
    getItem: vi.fn(async <T>(key: string): Promise<T | null> => {
        return (localforageStore.get(key) as T) ?? null;
    }),
    setItem: vi.fn(async <T>(key: string, value: T): Promise<T> => {
        localforageStore.set(key, value);
        return value;
    }),
    removeItem: vi.fn(async (key: string): Promise<void> => {
        localforageStore.delete(key);
    }),
    clear: vi.fn(async (): Promise<void> => {
        localforageStore.clear();
    }),
    keys: vi.fn(async (): Promise<string[]> => {
        return Array.from(localforageStore.keys());
    }),
};

// Create mock Fuse.js
class MockFuse<T> {
    private items: T[];
    private keys: string[];

    constructor(items: T[], options?: { keys?: string[] }) {
        this.items = items;
        this.keys = options?.keys ?? [];
    }

    search(query: string): Array<{ item: T; score: number }> {
        const lowerQuery = query.toLowerCase();
        return this.items
            .filter((item) => {
                return this.keys.some((key) => {
                    const value = (item as Record<string, unknown>)[key];
                    return (
                        typeof value === 'string' &&
                        value.toLowerCase().includes(lowerQuery)
                    );
                });
            })
            .map((item) => ({ item, score: 0.5 }));
    }
}

// =============================================================================
// GLOBAL DECLARATIONS
// =============================================================================

// SillyTavern global
const SillyTavern = {
    getContext: () => mockContext,
    libs: {
        lodash: mockLodash,
        DOMPurify: mockDOMPurify,
        localforage: mockLocalforage,
        Fuse: MockFuse,
    },
};

// toastr global
const toastr = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    clear: vi.fn(),
};

// Assign to globalThis
Object.assign(globalThis, { SillyTavern, toastr });

// =============================================================================
// TEST LIFECYCLE HOOKS
// =============================================================================

beforeEach(() => {
    // Fresh context for each test
    mockContext = createMockContext();

    // Clear localforage store
    localforageStore.clear();

    // Reset all mocks
    vi.clearAllMocks();
});

afterEach(() => {
    // Cleanup
    vi.restoreAllMocks();
});

// =============================================================================
// TEST UTILITIES
// =============================================================================

/**
 * Get the current mock context for test assertions.
 */
export function getMockContext(): MockSTContext {
    return mockContext;
}

/**
 * Set extension settings for testing.
 */
export function setMockSettings(
    moduleName: string,
    settings: Record<string, unknown>,
): void {
    mockContext.extensionSettings[moduleName] = settings;
}

/**
 * Add characters to the mock context.
 */
export function setMockCharacters(characters: MockCharacter[]): void {
    mockContext.characters = characters;
}

/**
 * Simulate an event emission.
 */
export function emitMockEvent(eventType: string, ...args: unknown[]): void {
    mockContext.eventSource.emit(eventType, ...args);
}

/**
 * Get the mock localforage store for assertions.
 */
export function getLocalforageStore(): Map<string, unknown> {
    return localforageStore;
}

/**
 * Get mock toastr for assertions.
 */
export function getMockToastr(): typeof toastr {
    return toastr;
}
