// src/ui/components/apply-suggestions/apply.ts
// =============================================================================
// APPLY/SAVE FUNCTIONS
// =============================================================================

import { toast } from '../../../shared';
import { getState } from '../../../state';
import { downloadCharacterPng } from '../../../domain/png-writer';
import { editCharacterAttribute, getCharacterJson } from './api';

// =============================================================================
// APPLY FUNCTIONS
// =============================================================================

/**
 * Apply modified fields directly to the character card.
 */
export async function applyFieldsToCharacter(
    avatarUrl: string,
    charName: string,
    fields: Array<{ key: string; value: string }>,
): Promise<void> {
    let successCount = 0;

    for (const field of fields) {
        // Handle alternate_greetings as array
        const value =
            field.key === 'alternate_greetings'
                ? field.value.split('\n---\n').filter((s) => s.trim())
                : field.value;

        const success = await editCharacterAttribute(
            avatarUrl,
            charName,
            field.key,
            value,
        );

        if (success) {
            successCount++;
        } else {
            toast.error(`Failed to update ${field.key}`);
        }
    }

    if (successCount > 0) {
        const ctx = SillyTavern.getContext();
        await ctx.getCharacters();
        toast.success(
            `Applied ${successCount} field${successCount > 1 ? 's' : ''} to character!`,
        );
    }
}

/**
 * Save character as PNG with modified fields.
 * Creates a new PNG file WITHOUT modifying the original character.
 */
export async function savePngWithFields(
    avatarUrl: string,
    charName: string,
    fields: Array<{ key: string; value: string }>,
): Promise<void> {
    // Get current character JSON (for base data)
    const charJson = await getCharacterJson(avatarUrl);
    if (!charJson) {
        toast.error('Failed to get character data');
        return;
    }

    // Apply modifications to a copy of the JSON (NOT the original)
    for (const field of fields) {
        const value =
            field.key === 'alternate_greetings'
                ? field.value.split('\n---\n').filter((s) => s.trim())
                : field.value;

        // Update both top-level and data fields
        charJson[field.key] = value;
        if (charJson.data && typeof charJson.data === 'object') {
            (charJson.data as Record<string, unknown>)[field.key] = value;
        }
    }

    // Create PNG with modified data (client-side, no server changes)
    const success = await downloadCharacterPng(
        avatarUrl,
        charJson,
        `${charName}_refined.png`,
    );

    if (success) {
        toast.success('PNG downloaded! (Original character unchanged)');
    } else {
        toast.error('Failed to create PNG');
    }
}

/**
 * Save character as JSON with modified fields.
 */
export async function saveJsonWithFields(
    avatarUrl: string,
    fields: Array<{ key: string; value: string }>,
): Promise<void> {
    const state = getState();
    if (!state.character) return;

    // Get current character JSON
    const charJson = await getCharacterJson(avatarUrl);
    if (!charJson) {
        toast.error('Failed to get character data');
        return;
    }

    // Apply modifications to JSON
    for (const field of fields) {
        const value =
            field.key === 'alternate_greetings'
                ? field.value.split('\n---\n').filter((s) => s.trim())
                : field.value;

        // Update both top-level and data fields
        charJson[field.key] = value;
        if (charJson.data && typeof charJson.data === 'object') {
            (charJson.data as Record<string, unknown>)[field.key] = value;
        }
    }

    // Download JSON
    const jsonString = JSON.stringify(charJson, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.character.name}_updated.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('JSON downloaded!');
}
