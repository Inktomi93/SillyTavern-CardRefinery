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
 * A single lorebook/character book entry.
 * Based on TavernCardV2 spec: https://github.com/malfoyslastname/character-card-spec-v2
 *
 * Note: All fields are marked optional for compatibility with ST's internal types,
 * though the V2 spec requires keys, content, extensions, enabled, and insertion_order.
 */
export interface CharacterBookEntry {
    // Core fields (required in V2 spec, but optional here for ST compatibility)
    keys?: string[];
    content?: string;
    extensions?: Record<string, unknown>;
    enabled?: boolean;
    insertion_order?: number;

    // Optional fields
    id?: number;
    name?: string;
    comment?: string;
    priority?: number;
    secondary_keys?: string[];
    selective?: boolean;
    constant?: boolean;
    case_sensitive?: boolean;
    use_regex?: boolean;
    position?: 'before_char' | 'after_char';
}

/**
 * Character book / embedded lorebook structure.
 * Based on TavernCardV2 spec.
 *
 * Note: Fields marked optional for compatibility with ST's internal types.
 */
export interface CharacterBook {
    name?: string;
    description?: string;
    scan_depth?: number;
    token_budget?: number;
    recursive_scanning?: boolean;
    extensions?: Record<string, unknown>;
    entries?: CharacterBookEntry[];
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
    character_book?: CharacterBook;
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
