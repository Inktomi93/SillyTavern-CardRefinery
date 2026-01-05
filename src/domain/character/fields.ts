// src/domain/character/fields.ts
// =============================================================================
// CHARACTER FIELD EXTRACTION
//
// Handles both V1 (top-level) and V2 (nested data.*) character card formats.
// Uses ST's unshallowCharacter() to ensure full data is loaded.
// =============================================================================

import { CHARACTER_FIELDS, log } from '../../shared';
import type { Character, CharacterField, PopulatedField } from '../../types';

// =============================================================================
// UNSHALLOW UTILITIES
// =============================================================================

/**
 * Ensure character data is fully loaded (not shallow/lazy-loaded).
 *
 * ST lazy-loads character data for performance. Call this before
 * accessing character fields to ensure full data is available.
 */
export async function ensureUnshallowed(char: Character): Promise<Character> {
    const ctx = SillyTavern.getContext();

    // Find character index in ST's character array
    const characters = ctx.characters || [];
    const charIndex = characters.findIndex(
        (c: Character) => c.avatar === char.avatar,
    );

    if (charIndex === -1) {
        log.debug('Character not found in ST array, using provided data');
        return char;
    }

    const stChar = characters[charIndex];

    // Check if shallow (lazy-loaded)
    if (stChar.shallow && typeof ctx.unshallowCharacter === 'function') {
        log.debug(`Unshallowing character: ${char.name}`);
        await ctx.unshallowCharacter(charIndex);
        // Return the updated character from ST's array
        return characters[charIndex] as Character;
    }

    return stChar as Character;
}

/**
 * Synchronous check if character needs unshallowing.
 */
export function isShallow(char: Character): boolean {
    return !!char.shallow;
}

// =============================================================================
// PATH RESOLUTION WITH FALLBACK
// =============================================================================

/**
 * Get value from object using dot-notation path with V1/V2 fallback.
 *
 * For paths like 'data.system_prompt', also checks top-level 'system_prompt'
 * to support both V1 and V2 character card formats.
 */
function getByPathWithFallback(obj: unknown, path: string): unknown {
    const charObj = obj as Record<string, unknown>;

    // Try the specified path first
    let value = getByPath(charObj, path);

    // If no value and path starts with 'data.', try top-level as V1 fallback
    if (value === undefined && path.startsWith('data.')) {
        const topLevelKey = path
            .replace(/^data\./, '')
            .replace(/^extensions\./, '');
        value = getByPath(charObj, topLevelKey);

        // Also try directly on the char object for simple fields
        if (value === undefined && topLevelKey in charObj) {
            value = charObj[topLevelKey];
        }
    }

    // Special handling for nested extensions paths
    if (value === undefined && path.startsWith('data.extensions.')) {
        const extKey = path.replace('data.extensions.', '');
        // Try char.extensions.{key}
        value = getByPath(charObj, `extensions.${extKey}`);
    }

    return value;
}

/**
 * Get value from object using dot-notation path.
 */
function getByPath(obj: unknown, path: string): unknown {
    return path.split('.').reduce((curr, key) => {
        if (curr && typeof curr === 'object') {
            return (curr as Record<string, unknown>)[key];
        }
        return undefined;
    }, obj);
}

/**
 * Check if value is populated.
 */
function isPopulated(value: unknown, type?: string): boolean {
    if (value === null || value === undefined) return false;

    switch (type) {
        case 'array':
            return Array.isArray(value) && value.length > 0;
        case 'object':
            if (typeof value !== 'object') return false;
            // depth_prompt: check for non-empty prompt
            if ('prompt' in value) {
                return (
                    typeof (value as { prompt?: string }).prompt === 'string' &&
                    (value as { prompt: string }).prompt.trim().length > 0
                );
            }
            // character_book: check for entries
            if ('entries' in value) {
                return (
                    Array.isArray((value as { entries?: unknown[] }).entries) &&
                    (value as { entries: unknown[] }).entries.length > 0
                );
            }
            return Object.keys(value).length > 0;
        default:
            return typeof value === 'string' && value.trim().length > 0;
    }
}

/**
 * Format field value as string.
 */
export function formatValue(value: unknown, field: CharacterField): string {
    switch (field.type) {
        case 'array':
            if (!Array.isArray(value)) return '';
            return value
                .map((v, i) => `${i + 1}. ${String(v).trim()}`)
                .join('\n');

        case 'object':
            return formatObjectValue(value, field.key);

        default:
            return typeof value === 'string' ? value.trim() : String(value);
    }
}

/**
 * Format object-type fields.
 */
function formatObjectValue(value: unknown, key: string): string {
    if (!value || typeof value !== 'object') return '';

    if (key === 'depth_prompt') {
        const dp = value as { prompt?: string; depth?: number; role?: string };
        if (!dp.prompt?.trim()) return '';
        return `[Depth: ${dp.depth ?? 0}, Role: ${dp.role ?? 'system'}]\n${dp.prompt.trim()}`;
    }

    if (key === 'character_book') {
        const book = value as {
            name?: string;
            entries?: Array<{
                comment?: string;
                keys: string[];
                content: string;
                enabled: boolean;
            }>;
        };
        if (!book.entries?.length) return '';

        const lines: string[] = [];
        if (book.name) lines.push(`Lorebook: ${book.name}`);
        lines.push(`Entries: ${book.entries.length}`);

        for (const entry of book.entries.slice(0, 10)) {
            const status = entry.enabled ? '✓' : '✗';
            const label = entry.comment || entry.keys.slice(0, 3).join(', ');
            lines.push(`  ${status} ${label}`);
        }

        if (book.entries.length > 10) {
            lines.push(`  ... and ${book.entries.length - 10} more`);
        }

        return lines.join('\n');
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return '[Complex Object]';
    }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get all populated fields from a character.
 *
 * Supports both V1 (top-level) and V2 (data.*) character card formats.
 * For best results, call ensureUnshallowed() first to load full data.
 */
export function getPopulatedFields(char: Character): PopulatedField[] {
    if (!char) return [];

    const result: PopulatedField[] = [];

    for (const field of CHARACTER_FIELDS) {
        // Use path with V1/V2 fallback
        const raw = getByPathWithFallback(char, field.path);
        if (!isPopulated(raw, field.type)) continue;

        const formatted = formatValue(raw, field);
        if (!formatted) continue;

        result.push({
            key: field.key,
            label: field.label,
            value: formatted,
            rawValue: raw,
            charCount: formatted.length,
            type: field.type,
        });
    }

    return result;
}

/**
 * Get populated fields asynchronously, ensuring character is unshallowed first.
 */
export async function getPopulatedFieldsAsync(
    char: Character,
): Promise<PopulatedField[]> {
    const fullChar = await ensureUnshallowed(char);
    return getPopulatedFields(fullChar);
}

/**
 * Check if character has any populated fields.
 */
export function hasPopulatedFields(char: Character): boolean {
    return getPopulatedFields(char).length > 0;
}

/**
 * Get total character count across all fields.
 */
export function getTotalCharCount(char: Character): number {
    return getPopulatedFields(char).reduce((sum, f) => sum + f.charCount, 0);
}

/**
 * Validate character data and return issues.
 */
export function validateCharacter(char: Character): string[] {
    const issues: string[] = [];

    if (!char) {
        issues.push('No character provided');
        return issues;
    }

    if (!char.name?.trim()) {
        issues.push('Character has no name');
    }

    // Don't require data object - V1 cards may not have it
    const fields = getPopulatedFields(char);
    if (fields.length === 0) {
        issues.push('Character has no populated fields');
    }

    return issues;
}

/**
 * Get preview of field value (truncated).
 */
export function getFieldPreview(value: string, maxLength = 100): string {
    return value.length <= maxLength
        ? value
        : value.substring(0, maxLength - 3) + '...';
}
