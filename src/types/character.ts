// src/types/character.ts
// =============================================================================
// CHARACTER TYPE DEFINITIONS
// =============================================================================

/**
 * Unique identifier for a character (avatar filename).
 */
export type CharacterId = string;

/**
 * Definition of a character field that can be extracted and analyzed.
 */
export interface CharacterField {
    key: string;
    label: string;
    path: string;
    type?: 'string' | 'array' | 'object';
}

/**
 * A character field with its extracted and formatted value.
 */
export interface PopulatedField {
    key: string;
    label: string;
    value: string;
    rawValue: unknown;
    charCount: number;
    /** Token count (loaded async, may be null if unavailable) */
    tokens?: number | null;
    type?: 'string' | 'array' | 'object';
}

/**
 * Nested character data (V2 card spec extensions).
 */
export interface CharacterData {
    system_prompt?: string;
    post_history_instructions?: string;
    creator_notes?: string;
    creator?: string;
    character_version?: string;
    alternate_greetings?: string[];
    extensions?: {
        depth_prompt?: { prompt: string; depth: number; role: string };
    };
    character_book?: {
        name?: string;
        entries: Array<{
            id: number;
            keys: string[];
            content: string;
            comment?: string;
            enabled: boolean;
        }>;
    };
}

/**
 * Minimal character interface - what we actually use from ST.
 *
 * Supports both V1 (top-level fields) and V2 (nested data.*) card formats.
 * The `shallow` flag indicates lazy-loaded characters that need unshallowing.
 */
export interface Character {
    name: string;
    avatar: string;
    description?: string;
    personality?: string;
    first_mes?: string;
    scenario?: string;
    mes_example?: string;
    data?: CharacterData;

    // V1 top-level fields (for backwards compatibility)
    system_prompt?: string;
    post_history_instructions?: string;
    creator_notes?: string;

    // ST internal flags
    /** True if character data is lazy-loaded and needs unshallowing */
    shallow?: boolean;
    /** Current chat filename */
    chat?: string;
    /** Tags associated with character */
    tags?: string[];
}
