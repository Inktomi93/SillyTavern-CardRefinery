/**
 * Global type declarations for SillyTavern-CardRefinery extension.
 *
 * This file declares all SillyTavern types used by the extension so that
 * TypeScript can compile standalone (e.g., in CI) without the actual
 * SillyTavern codebase present.
 */

// =============================================================================
// SILLYTAVERN BUNDLED LIBRARIES
// =============================================================================

/**
 * Libraries bundled and exposed by SillyTavern via SillyTavern.libs
 */
interface SillyTavernLibs {
    /** Lodash utility library */
    lodash: {
        debounce<T extends (...args: never[]) => unknown>(
            func: T,
            wait?: number,
            options?: { leading?: boolean; trailing?: boolean; maxWait?: number },
        ): T & { cancel(): void; flush(): ReturnType<T> };
        throttle<T extends (...args: never[]) => unknown>(
            func: T,
            wait?: number,
            options?: { leading?: boolean; trailing?: boolean },
        ): T & { cancel(): void; flush(): ReturnType<T> };
        cloneDeep<T>(value: T): T;
        merge<T extends object>(object: T, ...sources: object[]): T;
        isEqual(value: unknown, other: unknown): boolean;
        get(object: object, path: string | string[], defaultValue?: unknown): unknown;
        set(object: object, path: string | string[], value: unknown): object;
        pick<T extends object, K extends keyof T>(object: T, ...keys: K[]): Pick<T, K>;
        omit<T extends object, K extends keyof T>(object: T, ...keys: K[]): Omit<T, K>;
        sortBy<T>(collection: T[], iteratees?: ((value: T) => unknown) | string): T[];
        uniqBy<T>(array: T[], iteratee: ((value: T) => unknown) | string): T[];
        groupBy<T>(collection: T[], iteratee: ((value: T) => unknown) | string): Record<string, T[]>;
        isEmpty(value: unknown): boolean;
        isNil(value: unknown): value is null | undefined;
        isString(value: unknown): value is string;
        isNumber(value: unknown): value is number;
        isObject(value: unknown): value is object;
        isArray(value: unknown): value is unknown[];
        isFunction(value: unknown): value is (...args: unknown[]) => unknown;
        capitalize(string: string): string;
        escapeRegExp(string: string): string;
        template(string: string, options?: object): (data: object) => string;
    };

    /** DOMPurify HTML sanitization library */
    DOMPurify: {
        sanitize(
            dirty: string | Node,
            config?: {
                ALLOWED_TAGS?: string[];
                ALLOWED_ATTR?: string[];
                USE_PROFILES?: { html?: boolean; svg?: boolean; mathMl?: boolean };
                RETURN_DOM?: boolean;
                RETURN_DOM_FRAGMENT?: boolean;
                RETURN_TRUSTED_TYPE?: boolean;
                FORCE_BODY?: boolean;
                SANITIZE_DOM?: boolean;
                KEEP_CONTENT?: boolean;
                ADD_TAGS?: string[];
                ADD_ATTR?: string[];
                FORBID_TAGS?: string[];
                FORBID_ATTR?: string[];
            },
        ): string;
        setConfig(config: object): void;
        clearConfig(): void;
        isSupported: boolean;
        version: string;
    };

    /** Fuse.js fuzzy search library */
    Fuse: {
        new <T>(
            list: T[],
            options?: {
                keys?: (string | { name: string; weight?: number })[];
                threshold?: number;
                distance?: number;
                includeScore?: boolean;
                includeMatches?: boolean;
                minMatchCharLength?: number;
                shouldSort?: boolean;
                findAllMatches?: boolean;
                location?: number;
                ignoreLocation?: boolean;
                useExtendedSearch?: boolean;
                isCaseSensitive?: boolean;
            },
        ): {
            search(pattern: string): { item: T; score?: number; matches?: object[] }[];
            setCollection(list: T[]): void;
            /** Internal docs collection */
            _docs: T[];
        };
    };

    /** localforage IndexedDB wrapper */
    localforage: {
        getItem<T>(key: string): Promise<T | null>;
        setItem<T>(key: string, value: T): Promise<T>;
        removeItem(key: string): Promise<void>;
        clear(): Promise<void>;
        length(): Promise<number>;
        key(keyIndex: number): Promise<string | null>;
        keys(): Promise<string[]>;
        iterate<T, U>(
            iteratee: (value: T, key: string, iterationNumber: number) => U,
        ): Promise<U | undefined>;
        createInstance(options: { name?: string; storeName?: string }): typeof this;
    };

    /** morphdom DOM diffing library */
    morphdom: (
        fromNode: Node | HTMLElement,
        toNode: Node | HTMLElement | string,
        options?: {
            getNodeKey?: (node: Node) => string | null;
            onBeforeNodeAdded?: (node: Node) => Node | null;
            onNodeAdded?: (node: Node) => Node | void;
            onBeforeElUpdated?: (fromEl: HTMLElement, toEl: HTMLElement) => boolean;
            onElUpdated?: (el: Element) => void;
            onBeforeNodeDiscarded?: (node: Node) => boolean;
            onNodeDiscarded?: (node: Node) => void;
            onBeforeElChildrenUpdated?: (fromEl: Element, toEl: Element) => boolean;
            childrenOnly?: boolean;
        },
    ) => Node;

    /** highlight.js syntax highlighting */
    hljs: {
        highlight(code: string, options: { language: string; ignoreIllegals?: boolean }): { value: string };
        highlightAuto(code: string, languageSubset?: string[]): { value: string; language: string };
        highlightElement(element: Element): void;
        configure(options: object): void;
        listLanguages(): string[];
        getLanguage(name: string): object | undefined;
    };

    /** Moment.js date library */
    moment: {
        (input?: string | number | Date | object): {
            format(formatString?: string): string;
            fromNow(withoutSuffix?: boolean): string;
            calendar(referenceTime?: unknown, formats?: object): string;
            diff(input: unknown, unit?: string, precise?: boolean): number;
            add(amount: number, unit: string): unknown;
            subtract(amount: number, unit: string): unknown;
            startOf(unit: string): unknown;
            endOf(unit: string): unknown;
            isBefore(input: unknown): boolean;
            isAfter(input: unknown): boolean;
            isSame(input: unknown, granularity?: string): boolean;
            valueOf(): number;
            unix(): number;
            toDate(): Date;
            toISOString(): string;
            isValid(): boolean;
        };
        utc(input?: string | number | Date): ReturnType<SillyTavernLibs["moment"]>;
        duration(input: number | string | object, unit?: string): object;
        now(): number;
    };

    /** Showdown markdown converter */
    showdown: {
        Converter: {
            new (options?: object): {
                makeHtml(text: string): string;
                makeMarkdown(html: string): string;
                setOption(key: string, value: unknown): void;
                getOption(key: string): unknown;
            };
        };
    };

    /** Handlebars template engine */
    Handlebars: {
        compile(template: string, options?: object): (context: object) => string;
        registerHelper(name: string, fn: (...args: unknown[]) => unknown): void;
        registerPartial(name: string, partial: string): void;
        SafeString: { new (str: string): { toString(): string } };
        escapeExpression(str: string): string;
    };
}

// =============================================================================
// SILLYTAVERN CONTEXT API
// =============================================================================

/**
 * Popup result enum values
 */
interface PopupResult {
    AFFIRMATIVE: 1;
    NEGATIVE: 0;
    CANCELLED: null;
}

/**
 * Popup types
 */
interface PopupType {
    TEXT: 1;
    CONFIRM: 2;
    INPUT: 3;
    DISPLAY: 4;
    CROP: 5;
}

/**
 * Popup show methods
 */
interface PopupShow {
    confirm(title: string, message?: string, options?: object): Promise<boolean | 1 | 0 | null>;
    input(title: string, message?: string, defaultValue?: string, options?: object): Promise<string | null>;
    text(title: string, message?: string, options?: object): Promise<void>;
}

/**
 * Popup class (constructable)
 */
interface PopupClass {
    new (
        content: string | HTMLElement,
        type?: number,
        inputValue?: string,
        options?: object,
    ): {
        show(): Promise<unknown>;
        inputResults: Record<string, unknown>;
    };
    show: PopupShow;
    RESULT: PopupResult;
    TYPE: PopupType;
}

/**
 * Character data structure - compatible with both ST runtime format and local Character type
 */
interface STCharacterData {
    name: string;
    avatar: string;
    description?: string;
    personality?: string;
    scenario?: string;
    first_mes?: string;
    mes_example?: string;
    creatorcomment?: string;
    creator_notes?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    tags?: string[];
    talkativeness?: number;
    fav?: boolean | string;
    create_date?: string;
    chat?: string;
    json_data?: string;
    shallow?: boolean;
    data?: {
        name?: string;
        description?: string;
        personality?: string;
        scenario?: string;
        first_mes?: string;
        mes_example?: string;
        creator_notes?: string;
        system_prompt?: string;
        post_history_instructions?: string;
        alternate_greetings?: string[];
        character_book?: {
            name?: string;
            entries?: Array<{
                id: number;
                keys: string[];
                content: string;
                comment?: string;
                enabled: boolean;
            }>;
        };
        tags?: string[];
        creator?: string;
        character_version?: string;
        extensions?: {
            talkativeness?: number;
            fav?: boolean;
            world?: string;
            depth_prompt?: {
                depth: number;
                prompt: string;
                role: string;
            };
            regex_scripts?: object[];
        };
    };
}

/**
 * Event source interface
 */
interface STEventSource {
    on(event: string, callback: (...args: unknown[]) => void): void;
    once(event: string, callback: (...args: unknown[]) => void): void;
    off(event: string, callback: (...args: unknown[]) => void): void;
    emit(event: string, ...args: unknown[]): void;
    removeListener(event: string, callback: (...args: unknown[]) => void): void;
}

/**
 * Event types available in SillyTavern
 */
interface STEventTypes {
    APP_READY: string;
    CHARACTER_EDITED: string;
    CHARACTER_DELETED: string;
    CHAT_CHANGED: string;
    MESSAGE_SENT: string;
    MESSAGE_RECEIVED: string;
    MESSAGE_EDITED: string;
    MESSAGE_DELETED: string;
    GENERATION_STARTED: string;
    GENERATION_STOPPED: string;
    GENERATION_ENDED: string;
    SETTINGS_UPDATED: string;
    SETTINGS_LOADED: string;
    EXTENSION_SETTINGS_LOADED: string;
    STREAM_TOKEN_RECEIVED: string;
    GROUP_UPDATED: string;
    WORLDINFO_UPDATED: string;
    ONLINE_STATUS_CHANGED: string;
    [key: string]: string;
}

/**
 * Chat completion settings (oai_settings)
 */
interface ChatCompletionSettings {
    chat_completion_source: string;
    openai_max_context: number;
    openai_max_tokens: number;
    temperature: number;
    top_p: number;
    top_k: number;
    min_p: number;
    frequency_penalty: number;
    freq_pen: number;
    presence_penalty: number;
    presence_pen: number;
    bypass_status_check: boolean;
    [key: string]: unknown;
}

/**
 * Text completion settings (textgenerationwebui_settings)
 */
interface TextCompletionSettings {
    max_length: number;
    temperature: number;
    top_p: number;
    top_k: number;
    min_p: number;
    frequency_penalty: number;
    freq_pen: number;
    presence_penalty: number;
    presence_pen: number;
    [key: string]: unknown;
}

/**
 * Connection manager request service
 */
interface ConnectionManagerRequestService {
    sendRequest(data: object): Promise<{ content: string; reasoning?: string }>;
    getSupportedProfiles(): Array<{
        id: string;
        name: string;
        api: string;
        model: string;
        mode: 'cc' | 'tc';
        presetName: string;
        [key: string]: unknown;
    }>;
}

/**
 * Chat completion service
 */
interface ChatCompletionService {
    sendRequest(data: object): Promise<{ content: string; reasoning?: string }>;
    createRequestData(options: {
        messages: Array<{ role: string; content: string }>;
        max_tokens?: number;
        temperature?: number;
        chat_completion_source?: string;
        [key: string]: unknown;
    }): object;
}

/**
 * SillyTavern context returned by getContext()
 */
interface SillyTavernContext {
    // Core state
    chat: object[];
    characters: STCharacterData[];
    groups: object[];
    name1: string;
    name2: string;
    characterId: number | null;
    groupId: string | null;
    chatId: string;
    onlineStatus: string;
    maxContext: number;

    // Extension settings (each extension stores its own settings object)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extensionSettings: Record<string, any>;
    saveSettingsDebounced: () => void;

    // Chat metadata
    chatMetadata: Record<string, unknown>;
    saveMetadata: () => Promise<void>;
    saveMetadataDebounced: () => void;

    // Events
    eventSource: STEventSource;
    eventTypes: STEventTypes;

    // Popup
    Popup: PopupClass;
    POPUP_TYPE: PopupType;
    POPUP_RESULT: PopupResult;
    callGenericPopup: (content: string, type?: number, value?: string, options?: object) => Promise<unknown>;

    // Generation
    generateQuietPrompt: (prompt: string, quiet?: boolean, skipWI?: boolean, options?: object) => Promise<string>;
    generateRaw: (options: {
        prompt: string;
        systemPrompt?: string;
        responseLength?: number | null;
        jsonSchema?: object | null;
        [key: string]: unknown;
    }) => Promise<string>;
    stopGeneration: () => void;

    // Tokenization
    tokenizers: Record<string, number>;
    getTokenCount: (text: string) => number;
    getTokenCountAsync: (text: string, padding?: number) => Promise<number>;
    getTextTokens: (tokenizer: number, text: string) => number[];
    getTokenizerModel: () => string;

    // Character operations
    getCharacters: () => Promise<void>;
    getThumbnailUrl: (type: string, file: string) => string;
    selectCharacterById: (id: string) => void;

    // Services
    ChatCompletionService: ChatCompletionService;
    ConnectionManagerRequestService: ConnectionManagerRequestService;

    // Utilities
    uuidv4: () => string;
    substituteParams: (text: string, name1?: string, name2?: string, original?: string, group?: string) => string;
    substituteParamsExtended: (text: string, additionalMacros?: Record<string, string>) => string;
    getRequestHeaders: () => Record<string, string>;

    // API info
    mainApi: string;
    chatCompletionSettings: ChatCompletionSettings;
    textCompletionSettings: TextCompletionSettings;

    // Other
    [key: string]: unknown;
}

// =============================================================================
// SILLYTAVERN GLOBAL NAMESPACE
// =============================================================================

/**
 * Main SillyTavern global namespace
 */
declare const SillyTavern: {
    /**
     * Get the SillyTavern context with all APIs
     */
    getContext(): SillyTavernContext;

    /**
     * Bundled libraries available for extensions
     */
    libs: SillyTavernLibs;
};

// =============================================================================
// OTHER GLOBALS
// =============================================================================

/**
 * Toastr notification library (globally available in ST)
 */
declare const toastr: {
    success(message: string, title?: string, options?: Record<string, unknown>): void;
    error(message: string, title?: string, options?: Record<string, unknown>): void;
    warning(message: string, title?: string, options?: Record<string, unknown>): void;
    info(message: string, title?: string, options?: Record<string, unknown>): void;
    clear(): void;
};
