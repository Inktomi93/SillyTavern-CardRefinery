// src/ui/components/apply-suggestions/api.ts
// =============================================================================
// CHARACTER API FUNCTIONS
// =============================================================================

import { log } from '../../../shared';

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Edit a single character attribute via ST API.
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
 * Get character JSON data.
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
