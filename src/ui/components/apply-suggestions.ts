// src/ui/components/apply-suggestions.ts
// =============================================================================
// APPLY SUGGESTIONS COMPONENT
// Allows users to apply rewritten content back to the character card
// =============================================================================

import { toast, log } from '../../shared';
import { getState } from '../../state';
import { getPopulatedFields } from '../../domain/character/fields';

// =============================================================================
// TYPES
// =============================================================================

interface FieldUpdate {
    key: string;
    label: string;
    original: string;
    rewritten: string;
    selected: boolean;
}

// =============================================================================
// PARSE UTILITIES
// =============================================================================

/**
 * Parse rewrite output to extract field values.
 * Handles common markdown section formats.
 */
function parseRewriteOutput(output: string): Record<string, string> {
    const fields: Record<string, string> = {};

    // Match sections like "### Description" or "## Personality"
    const sectionRegex = /^#{2,3}\s*(.+?)[\s:]*$/gm;
    const sections: { name: string; start: number }[] = [];

    let match;
    while ((match = sectionRegex.exec(output)) !== null) {
        sections.push({
            name: match[1].trim().toLowerCase(),
            start: match.index + match[0].length,
        });
    }

    // Extract content between sections
    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const nextStart = sections[i + 1]?.start ?? output.length;
        const content = output.slice(section.start, nextStart).trim();

        // Remove trailing section markers
        const cleanContent = content.replace(/^#{2,3}\s*.+$/gm, '').trim();

        // Map section names to field keys
        const fieldKey = mapSectionToFieldKey(section.name);
        if (fieldKey && cleanContent) {
            fields[fieldKey] = cleanContent;
        }
    }

    return fields;
}

/**
 * Map section name to field key.
 */
function mapSectionToFieldKey(sectionName: string): string | null {
    const normalized = sectionName.toLowerCase().replace(/[^a-z0-9]/g, '');

    const mappings: Record<string, string> = {
        description: 'description',
        personality: 'personality',
        firstmessage: 'first_mes',
        greeting: 'first_mes',
        scenario: 'scenario',
        examplemessages: 'mes_example',
        examples: 'mes_example',
        systemprompt: 'system_prompt',
        system: 'system_prompt',
        posthistoryinstructions: 'post_history_instructions',
        posthistory: 'post_history_instructions',
        creatornotes: 'creator_notes',
        notes: 'creator_notes',
        alternategreetings: 'alternate_greetings',
        greetings: 'alternate_greetings',
    };

    return mappings[normalized] || null;
}

// =============================================================================
// BUILD UPDATES
// =============================================================================

/**
 * Build field updates from state.
 */
export function buildFieldUpdates(): FieldUpdate[] {
    const state = getState();
    const updates: FieldUpdate[] = [];

    if (!state.character || !state.stageResults.rewrite) {
        return updates;
    }

    const originalFields = getPopulatedFields(state.character);
    const rewrittenFields = parseRewriteOutput(
        state.stageResults.rewrite.output,
    );

    for (const field of originalFields) {
        const rewritten = rewrittenFields[field.key];
        if (rewritten && rewritten !== field.value) {
            updates.push({
                key: field.key,
                label: field.label,
                original: field.value,
                rewritten,
                selected: true,
            });
        }
    }

    return updates;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Edit a single character attribute via ST API.
 */
async function editCharacterAttribute(
    avatarUrl: string,
    charName: string,
    field: string,
    value: string,
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
 * Export character as PNG with current data.
 */
export async function exportCharacterPng(
    avatarUrl: string,
): Promise<Blob | null> {
    const ctx = SillyTavern.getContext();

    try {
        const response = await fetch('/api/characters/export', {
            method: 'POST',
            headers: ctx.getRequestHeaders(),
            body: JSON.stringify({
                avatar_url: avatarUrl,
                format: 'png',
            }),
        });

        if (!response.ok) return null;
        return await response.blob();
    } catch (error) {
        log.error('Failed to export character:', error);
        return null;
    }
}

/**
 * Get character JSON data.
 */
async function getCharacterJson(
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
// APPLY FUNCTIONS
// =============================================================================

/**
 * Apply updates directly to character card via API.
 */
export async function applyUpdatesDirectly(
    updates: FieldUpdate[],
): Promise<boolean> {
    const state = getState();
    if (!state.character) return false;

    const char = state.character;
    let successCount = 0;

    for (const update of updates) {
        if (!update.selected) continue;

        const success = await editCharacterAttribute(
            char.avatar,
            char.name,
            update.key,
            update.rewritten,
        );

        if (success) {
            successCount++;
        } else {
            toast.error(`Failed to update ${update.label}`);
        }
    }

    if (successCount > 0) {
        // Refresh character data
        const ctx = SillyTavern.getContext();
        await ctx.getCharacters();

        toast.success(
            `Applied ${successCount} update${successCount > 1 ? 's' : ''} to character!`,
        );
    }

    return successCount === updates.filter((u) => u.selected).length;
}

/**
 * Download character card with updates applied.
 */
export async function downloadWithUpdates(
    updates: FieldUpdate[],
): Promise<boolean> {
    const state = getState();
    if (!state.character) return false;

    const char = state.character;

    // Get current character JSON
    const charJson = await getCharacterJson(char.avatar);
    if (!charJson) {
        toast.error('Failed to get character data');
        return false;
    }

    // Apply updates to JSON
    for (const update of updates) {
        if (!update.selected) continue;

        // Update both top-level and data fields for compatibility
        (charJson as Record<string, unknown>)[update.key] = update.rewritten;
        if (charJson.data && typeof charJson.data === 'object') {
            (charJson.data as Record<string, unknown>)[update.key] =
                update.rewritten;
        }
    }

    // Create downloadable JSON
    const jsonString = JSON.stringify(charJson, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `${char.name}_updated.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Character JSON downloaded!');
    return true;
}

/**
 * Download character card as PNG with updates applied.
 * This applies updates first, exports the PNG, then optionally reverts.
 */
export async function downloadPngWithUpdates(
    updates: FieldUpdate[],
): Promise<boolean> {
    const state = getState();
    if (!state.character) return false;

    const char = state.character;

    // First apply the updates temporarily
    let appliedCount = 0;
    const originalValues: Record<string, string> = {};

    for (const update of updates) {
        if (!update.selected) continue;

        // Store original value for potential revert
        originalValues[update.key] = update.original;

        const success = await editCharacterAttribute(
            char.avatar,
            char.name,
            update.key,
            update.rewritten,
        );

        if (success) {
            appliedCount++;
        }
    }

    if (appliedCount === 0) {
        toast.error('Failed to apply updates for PNG export');
        return false;
    }

    // Now export the PNG
    const pngBlob = await exportCharacterPng(char.avatar);

    if (!pngBlob) {
        toast.error('Failed to export character PNG');
        // Revert the changes
        for (const [key, value] of Object.entries(originalValues)) {
            await editCharacterAttribute(char.avatar, char.name, key, value);
        }
        return false;
    }

    // Trigger download
    const url = URL.createObjectURL(pngBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${char.name}_updated.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Character PNG downloaded! (Changes applied to card)');

    // Refresh character data since we applied changes
    const ctx = SillyTavern.getContext();
    await ctx.getCharacters();

    return true;
}

/**
 * Download the current character as PNG (no updates applied).
 */
export async function downloadCurrentCharacter(): Promise<boolean> {
    const state = getState();
    if (!state.character) {
        toast.warning('No character selected');
        return false;
    }

    const char = state.character;
    const pngBlob = await exportCharacterPng(char.avatar);

    if (!pngBlob) {
        toast.error('Failed to export character PNG');
        return false;
    }

    // Trigger download
    const url = URL.createObjectURL(pngBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${char.name}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Character PNG downloaded!');
    return true;
}

// =============================================================================
// DIALOG
// =============================================================================

/**
 * Show apply dialog and handle user choice.
 */
export async function showApplyDialog(): Promise<void> {
    const updates = buildFieldUpdates();

    if (updates.length === 0) {
        toast.warning('No changes detected in the rewrite output.');
        return;
    }

    const DOMPurify = SillyTavern.libs.DOMPurify;

    // Build dialog content
    const content = /* html */ `
        <div class="cr-apply-dialog">
            <p class="cr-apply-dialog__intro">
                <strong>${updates.length} field${updates.length > 1 ? 's' : ''}</strong> modified. 
                Select which fields to apply:
            </p>
            
            <div class="cr-apply-dialog__fields">
                ${updates
                    .map(
                        (update, i) => /* html */ `
                    <div class="cr-apply-field">
                        <label class="cr-apply-field__header">
                            <input type="checkbox"
                                   class="cr-apply-checkbox"
                                   data-field-index="${i}"
                                   ${update.selected ? 'checked' : ''}/>
                            <span class="cr-apply-field__label">${update.label}</span>
                        </label>
                        <div class="cr-apply-field__preview">
                            <pre>${DOMPurify.sanitize(update.rewritten.substring(0, 300))}${update.rewritten.length > 300 ? '...' : ''}</pre>
                        </div>
                    </div>
                `,
                    )
                    .join('')}
            </div>
            
            <div class="cr-apply-dialog__actions">
                <button class="menu_button menu_button--sm cr-selecr-all-btn" type="button">
                    Select All
                </button>
                <button class="menu_button menu_button--sm cr-selecr-none-btn" type="button">
                    Select None
                </button>
            </div>
            
            <hr style="margin: 12px 0; border-color: var(--SmartThemeBorderColor);"/>

            <p class="cr-text-sm cr-text-dim">
                <strong>Apply Directly</strong> - Updates the character card in SillyTavern immediately.<br/>
                <strong>Download PNG</strong> - Downloads the original card image with updated metadata.<br/>
                <strong>Download JSON</strong> - Downloads a JSON file you can import elsewhere.
            </p>
        </div>
    `;

    // Show popup
    const ctx = SillyTavern.getContext();

    // Use a short delay to allow the popup to render, then bind events
    setTimeout(() => {
        const selectAllBtn = document.querySelector('.cr-selecr-all-btn');
        const selectNoneBtn = document.querySelector('.cr-selecr-none-btn');

        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                document
                    .querySelectorAll<HTMLInputElement>('.cr-apply-checkbox')
                    .forEach((cb) => (cb.checked = true));
            });
        }

        if (selectNoneBtn) {
            selectNoneBtn.addEventListener('click', () => {
                document
                    .querySelectorAll<HTMLInputElement>('.cr-apply-checkbox')
                    .forEach((cb) => (cb.checked = false));
            });
        }
    }, 0);

    const result = await ctx.callGenericPopup(
        content,
        ctx.POPUP_TYPE.CONFIRM,
        '',
        {
            okButton: 'Apply Directly',
            cancelButton: 'Cancel',
            customButtons: ['Download PNG', 'Download JSON'],
            wide: true,
        },
    );

    // Handle result
    if (result === false || result === undefined) {
        return; // Cancelled
    }

    // Collect selected updates
    const selectedUpdates = updates.filter((_, i) => {
        const checkbox = document.querySelector(
            `.cr-apply-checkbox[data-field-index="${i}"]`,
        ) as HTMLInputElement;
        return checkbox?.checked ?? false;
    });

    if (selectedUpdates.length === 0) {
        toast.warning('No fields selected.');
        return;
    }

    if (result === true) {
        // Apply Directly
        await applyUpdatesDirectly(selectedUpdates);
    } else if (result === 0) {
        // Download PNG (first custom button)
        await downloadPngWithUpdates(selectedUpdates);
    } else if (result === 1) {
        // Download JSON (second custom button)
        await downloadWithUpdates(selectedUpdates);
    }
}
