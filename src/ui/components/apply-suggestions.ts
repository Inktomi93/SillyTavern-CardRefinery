// src/ui/components/apply-suggestions.ts
// =============================================================================
// APPLY SUGGESTIONS COMPONENT
// Split-view editor for applying rewrite content to character fields
// =============================================================================

import {
    toast,
    log,
    CHARACTER_FIELDS,
    getTokenCountsKeyed,
} from '../../shared';
import { getState } from '../../state';
import { downloadCharacterPng } from '../../domain/png-writer';
import { getPopulatedFields } from '../../domain/character/fields';
import { formatTokenCount } from './base';
import type { CharacterField, PopulatedField } from '../../types';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format a field value for display/editing in textarea.
 * Different from formatValue in fields.ts - this is for editable content.
 */
function formatFieldForEditing(field: PopulatedField): string {
    const { rawValue, type, key } = field;

    if (rawValue === undefined || rawValue === null) {
        return '';
    }

    // Arrays: join with separator
    if (type === 'array' && Array.isArray(rawValue)) {
        return rawValue.join('\n---\n');
    }

    // Objects: special handling based on field type
    if (type === 'object') {
        if (key === 'depth_prompt') {
            const dp = rawValue as { prompt?: string };
            return dp.prompt || '';
        }
        if (key === 'character_book') {
            // Character book is complex - show as read-only JSON for now
            // Could be enhanced to show individual entries
            try {
                return JSON.stringify(rawValue, null, 2);
            } catch {
                return '[Character Lorebook - edit in ST]';
            }
        }
        try {
            return JSON.stringify(rawValue, null, 2);
        } catch {
            return '';
        }
    }

    return String(rawValue);
}

/**
 * Check if a field type is editable in the apply dialog.
 * Some complex fields like character_book are better edited in ST directly.
 */
function isEditableFieldType(field: CharacterField): boolean {
    // Character book is too complex for simple textarea editing
    if (field.key === 'character_book') {
        return false;
    }
    return true;
}

/**
 * Load and display token counts for apply dialog fields.
 * Called after the dialog renders to async update the badges.
 */
async function loadApplyDialogTokens(
    fieldMap: Map<string, PopulatedField>,
): Promise<void> {
    // Collect items to count
    const items: Array<{ key: string; text: string }> = [];

    for (const [key, field] of fieldMap) {
        if (key === 'alternate_greetings') continue; // Handled separately
        const text = formatFieldForEditing(field);
        if (text) {
            items.push({ key, text });
        }
    }

    if (items.length === 0) return;

    const results = await getTokenCountsKeyed(items);

    // Update badges in the DOM
    for (const { key, tokens } of results) {
        const badge = document.querySelector(
            `.cr-apply-field__tokens[data-field="${key}"]`,
        );
        if (badge && tokens !== null) {
            badge.textContent = `${formatTokenCount(tokens)} tokens`;
        }
    }
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
// LEGACY EXPORTS (for backwards compatibility with buildFieldUpdates)
// =============================================================================

/**
 * Build field updates from state (legacy - used by results panel).
 * @deprecated Use showApplyDialog instead
 */
export function buildFieldUpdates(): Array<{ key: string; value: string }> {
    const state = getState();
    if (!state.character || !state.stageResults.rewrite) {
        return [];
    }
    // Return empty - the new dialog handles everything
    // This prevents the old "X fields modified" logic
    return [];
}

// =============================================================================
// DIALOG
// =============================================================================

/**
 * Show the split-view apply dialog.
 */
export async function showApplyDialog(): Promise<void> {
    const state = getState();

    if (!state.character) {
        toast.warning('No character selected');
        return;
    }

    if (!state.stageResults.rewrite) {
        toast.warning('No rewrite results available');
        return;
    }

    const char = state.character;
    const rewriteOutput = state.stageResults.rewrite.output;
    const DOMPurify = SillyTavern.libs.DOMPurify;

    // Get all populated fields using the shared field extraction
    const populatedFields = getPopulatedFields(char);
    const fieldMap = new Map(populatedFields.map((f) => [f.key, f]));

    // Track alternate greetings separately for special handling
    const alternateGreetings: string[] = [];
    const altGreetingsField = fieldMap.get('alternate_greetings');
    if (altGreetingsField && Array.isArray(altGreetingsField.rawValue)) {
        alternateGreetings.push(...(altGreetingsField.rawValue as string[]));
    }

    // Build collapsible field editors - only for editable fields
    const editableFields = CHARACTER_FIELDS.filter(isEditableFieldType);

    const fieldEditorsHtml = editableFields
        .map((fieldDef) => {
            const populatedField = fieldMap.get(fieldDef.key);

            // Special handling for alternate greetings - render each as separate textarea
            if (fieldDef.key === 'alternate_greetings') {
                const greetingsHtml =
                    alternateGreetings.length > 0
                        ? alternateGreetings
                              .map((greeting, idx) => {
                                  const escapedGreeting =
                                      DOMPurify.sanitize(greeting);
                                  return /* html */ `
                        <div class="cr-apply-greetings__item">
                            <span class="cr-apply-greetings__label">Greeting ${idx + 1}</span>
                            <textarea
                                class="cr-apply-textarea cr-apply-greeting text_pole"
                                data-field-key="alternate_greetings"
                                data-greeting-index="${idx}"
                                data-original="${encodeURIComponent(greeting)}"
                                rows="4"
                                placeholder="Greeting ${idx + 1}..."
                            >${escapedGreeting}</textarea>
                        </div>
                    `;
                              })
                              .join('')
                        : /* html */ `<p class="cr-text-sm cr-text-dim">No alternate greetings defined</p>`;

                return /* html */ `
                <details class="cr-apply-field" data-field-key="${fieldDef.key}">
                    <summary class="cr-apply-field__header">
                        <span class="cr-apply-field__label">${fieldDef.label}</span>
                        <span class="cr-apply-field__badge ${alternateGreetings.length > 0 ? 'cr-apply-field__badge--filled' : 'cr-apply-field__badge--empty'}">
                            ${alternateGreetings.length > 0 ? `${alternateGreetings.length} greeting${alternateGreetings.length > 1 ? 's' : ''}` : 'empty'}
                        </span>
                        <span class="cr-apply-field__dirty" style="display: none;">modified</span>
                    </summary>
                    <div class="cr-apply-field__content">
                        <div class="cr-apply-greetings">
                            ${greetingsHtml}
                            <button type="button" class="cr-apply-greetings__add" data-action="add-greeting">
                                <i class="fa-solid fa-plus"></i> Add Greeting
                            </button>
                        </div>
                    </div>
                </details>
            `;
            }

            // Special handling for depth_prompt - show depth/role info
            if (fieldDef.key === 'depth_prompt' && populatedField) {
                const dp = populatedField.rawValue as {
                    prompt?: string;
                    depth?: number;
                    role?: string;
                };
                const promptValue = dp.prompt || '';
                const depthInfo = `Depth: ${dp.depth ?? 4}, Role: ${dp.role ?? 'system'}`;
                const escapedValue = DOMPurify.sanitize(promptValue);

                return /* html */ `
                <details class="cr-apply-field" data-field-key="${fieldDef.key}">
                    <summary class="cr-apply-field__header">
                        <span class="cr-apply-field__label">${fieldDef.label}</span>
                        <span class="cr-apply-field__badge cr-apply-field__badge--filled">
                            ${depthInfo}
                        </span>
                        <span class="cr-apply-field__dirty" style="display: none;">modified</span>
                    </summary>
                    <div class="cr-apply-field__content">
                        <textarea
                            class="cr-apply-textarea text_pole"
                            data-field-key="${fieldDef.key}"
                            data-field-type="depth_prompt"
                            data-original="${encodeURIComponent(promptValue)}"
                            data-depth="${dp.depth ?? 4}"
                            data-role="${dp.role ?? 'system'}"
                            rows="6"
                            placeholder="Depth prompt content..."
                        >${escapedValue}</textarea>
                    </div>
                </details>
            `;
            }

            // Standard field rendering
            const originalValue = populatedField
                ? formatFieldForEditing(populatedField)
                : '';
            const hasContent = originalValue.length > 0;
            const escapedValue = DOMPurify.sanitize(originalValue);

            return /* html */ `
            <details class="cr-apply-field" data-field-key="${fieldDef.key}">
                <summary class="cr-apply-field__header">
                    <span class="cr-apply-field__label">${fieldDef.label}</span>
                    <span class="cr-apply-field__badge cr-apply-field__tokens ${hasContent ? 'cr-apply-field__badge--filled' : 'cr-apply-field__badge--empty'}" data-field="${fieldDef.key}">
                        ${hasContent ? '...' : 'empty'}
                    </span>
                    <span class="cr-apply-field__dirty" style="display: none;">modified</span>
                </summary>
                <div class="cr-apply-field__content">
                    <textarea
                        class="cr-apply-textarea text_pole"
                        data-field-key="${fieldDef.key}"
                        data-original="${encodeURIComponent(originalValue)}"
                        rows="6"
                        placeholder="Paste content here..."
                    >${escapedValue}</textarea>
                </div>
            </details>
        `;
        })
        .join('');

    // Build dialog content with split view
    const content = /* html */ `
        <div class="cr-apply-dialog cr-apply-dialog--split">
            <div class="cr-apply-split">
                <!-- Left Panel: Rewrite Output -->
                <div class="cr-apply-panel cr-apply-panel--source">
                    <div class="cr-apply-panel__header">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        <span>Rewrite Output</span>
                    </div>
                    <textarea
                        class="cr-apply-source text_pole"
                        readonly
                        spellcheck="false"
                    >${DOMPurify.sanitize(rewriteOutput)}</textarea>
                </div>

                <!-- Right Panel: Character Fields -->
                <div class="cr-apply-panel cr-apply-panel--fields">
                    <div class="cr-apply-panel__header">
                        <i class="fa-solid fa-user-pen"></i>
                        <span>Character Fields</span>
                    </div>
                    <div class="cr-apply-fields-list">
                        ${fieldEditorsHtml}
                    </div>
                </div>
            </div>

            <div class="cr-apply-footer">
                <p class="cr-text-sm cr-text-dim">
                    Copy from the rewrite output and paste into the fields you want to update.
                    Modified fields are highlighted. Changes are only saved when you click an action button.
                </p>
            </div>
        </div>
    `;

    const ctx = SillyTavern.getContext();

    // Track modified fields - updated on input, read after popup closes
    const modifiedFields: Map<string, string> = new Map();
    // Track ALL greeting values (we need complete array when saving)
    const currentGreetings: string[] = [...alternateGreetings];
    // Track if any greeting was modified
    let greetingsModified = false;

    // Event delegation handler - works regardless of when elements are created
    const handleInput = (e: Event) => {
        const textarea = e.target as HTMLTextAreaElement;
        if (!textarea.matches('.cr-apply-textarea')) return;

        const fieldKey = textarea.dataset.fieldKey;
        const greetingIndexStr = textarea.dataset.greetingIndex;
        const originalEncoded = textarea.dataset.original || '';
        const original = decodeURIComponent(originalEncoded);

        const isDirty = textarea.value !== original;

        // Handle alternate greetings specially
        if (
            fieldKey === 'alternate_greetings' &&
            greetingIndexStr !== undefined
        ) {
            const greetingIndex = parseInt(greetingIndexStr, 10);

            // Always update the current value in our tracking array
            currentGreetings[greetingIndex] = textarea.value;

            if (isDirty) {
                greetingsModified = true;
            }

            // Check if ANY greeting differs from original
            const anyGreetingDirty =
                currentGreetings.some((val, idx) => {
                    const orig = alternateGreetings[idx] || '';
                    return val !== orig;
                }) || currentGreetings.length !== alternateGreetings.length;

            // Update dirty state for the parent field
            const fieldEl = textarea.closest('.cr-apply-field');
            const dirtyBadge = fieldEl?.querySelector(
                '.cr-apply-field__dirty',
            ) as HTMLElement;
            if (fieldEl) {
                fieldEl.classList.toggle(
                    'cr-apply-field--dirty',
                    anyGreetingDirty,
                );
            }
            if (dirtyBadge) {
                dirtyBadge.style.display = anyGreetingDirty ? 'inline' : 'none';
            }
            return;
        }

        // Standard field handling
        const fieldEl = textarea.closest('.cr-apply-field');
        const dirtyBadge = fieldEl?.querySelector(
            '.cr-apply-field__dirty',
        ) as HTMLElement;

        if (fieldEl) {
            fieldEl.classList.toggle('cr-apply-field--dirty', isDirty);
        }
        if (dirtyBadge) {
            dirtyBadge.style.display = isDirty ? 'inline' : 'none';
        }

        // Track modified fields for later
        if (fieldKey) {
            if (isDirty) {
                modifiedFields.set(fieldKey, textarea.value);
            } else {
                modifiedFields.delete(fieldKey);
            }
        }
    };

    // Handle Add Greeting button clicks
    const handleClick = (e: Event) => {
        const target = e.target as HTMLElement;
        const addBtn = target.closest('[data-action="add-greeting"]');
        if (!addBtn) return;

        e.preventDefault();
        const container = addBtn.closest('.cr-apply-greetings');
        if (!container) return;

        const newIndex = currentGreetings.length;
        currentGreetings.push(''); // Add empty slot
        greetingsModified = true;

        const newItem = document.createElement('div');
        newItem.className = 'cr-apply-greetings__item';
        newItem.innerHTML = /* html */ `
            <span class="cr-apply-greetings__label">Greeting ${newIndex + 1} (new)</span>
            <textarea
                class="cr-apply-textarea cr-apply-greeting text_pole"
                data-field-key="alternate_greetings"
                data-greeting-index="${newIndex}"
                data-original=""
                rows="4"
                placeholder="New greeting..."
            ></textarea>
        `;
        container.insertBefore(newItem, addBtn);

        // Update dirty state
        const fieldEl = container.closest('.cr-apply-field');
        const dirtyBadge = fieldEl?.querySelector(
            '.cr-apply-field__dirty',
        ) as HTMLElement;
        if (fieldEl) {
            fieldEl.classList.add('cr-apply-field--dirty');
        }
        if (dirtyBadge) {
            dirtyBadge.style.display = 'inline';
        }
    };

    // Attach delegated listeners BEFORE popup opens
    document.addEventListener('input', handleInput);
    document.addEventListener('click', handleClick);

    // Load token counts after popup renders (small delay ensures DOM is ready)
    setTimeout(() => loadApplyDialogTokens(fieldMap), 50);

    // Show popup with action buttons
    const result = await ctx.callGenericPopup(
        content,
        ctx.POPUP_TYPE.CONFIRM,
        '',
        {
            okButton: 'Apply to Card',
            cancelButton: 'Cancel',
            customButtons: ['Download PNG', 'Download JSON'],
            wide: true,
            large: true,
        },
    );

    // Clean up delegated listeners
    document.removeEventListener('input', handleInput);
    document.removeEventListener('click', handleClick);

    // Handle result
    if (result === false || result === undefined) {
        return; // Cancelled
    }

    // Build fields to apply
    const fieldsToApply = Array.from(modifiedFields.entries()).map(
        ([key, value]) => ({ key, value }),
    );

    // Handle alternate greetings - use tracked values (DOM is already removed)
    if (greetingsModified) {
        // Filter out empty greetings
        const nonEmptyGreetings = currentGreetings.filter((g) => g.trim());

        // Add to fields if there are greetings OR if we're clearing them
        if (nonEmptyGreetings.length > 0 || alternateGreetings.length > 0) {
            fieldsToApply.push({
                key: 'alternate_greetings',
                value: nonEmptyGreetings.join('\n---\n'),
            });
        }
    }

    if (fieldsToApply.length === 0) {
        toast.info('No changes to apply');
        return;
    }

    // Popup result values:
    // - true (or 1): okButton clicked ('Apply to Card')
    // - false/undefined: cancelButton or closed
    // - 2: first custom button ('Download PNG')
    // - 3: second custom button ('Download JSON')
    if (result === true || result === 1) {
        // Apply to Card - modifies the original character
        await applyFieldsToCharacter(char.avatar, char.name, fieldsToApply);
    } else if (result === 2) {
        // Download PNG - creates a new file without modifying original
        await savePngWithFields(char.avatar, char.name, fieldsToApply);
    } else if (result === 3) {
        // Download JSON - creates a new file without modifying original
        await saveJsonWithFields(char.avatar, fieldsToApply);
    } else {
        log.warn('Unknown result from apply dialog:', result);
    }
}

// =============================================================================
// APPLY FUNCTIONS
// =============================================================================

/**
 * Apply modified fields directly to the character card.
 */
async function applyFieldsToCharacter(
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
async function savePngWithFields(
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
async function saveJsonWithFields(
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
