// src/ui/components/stage-config/events.ts
// =============================================================================
// STAGE CONFIG EVENT BINDING
// =============================================================================

import {
    MODULE_NAME,
    STAGE_LABELS,
    popup,
    toast,
    generateUniqueName,
} from '../../../shared';
import {
    getState,
    updateStageConfig as updateStateConfig,
    toggleField,
    getCurrentFieldSelection,
    areStagesLinked,
    toggleStageFieldLinking,
} from '../../../state';
import {
    getPromptPreset,
    getSchemaPreset,
    presetRegistry,
    savePromptPreset,
    saveSchemaPreset,
    updatePromptPreset,
    updateSchemaPreset,
} from '../../../data';
import {
    getPopulatedFields,
    buildCharacterSummary,
    generateSchemaFromDescription,
} from '../../../domain';
import { $, $$, on } from '../base';
import { openDrawerWithList } from '../preset-drawer';
import { addPendingInput, removePendingInput } from './state';
import { updateFieldCheckboxes } from './field-selector';
import { updatePromptTokenCount } from './token-display';
import { updateStageConfig } from './stage-config';

// =============================================================================
// EVENT BINDING
// =============================================================================

/**
 * Bind stage config events.
 */
export function bindStageConfigEvents(container: HTMLElement): () => void {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const cleanups: Array<() => void> = [];

    // Link/unlink fields toggle
    const linkFieldsBtn = $(`#${MODULE_NAME}_link_fields`, container);
    if (linkFieldsBtn) {
        cleanups.push(
            on(linkFieldsBtn, 'click', () => {
                toggleStageFieldLinking();
                // Update button state
                const isLinked = areStagesLinked();
                linkFieldsBtn.classList.toggle('cr-active', isLinked);
                linkFieldsBtn.setAttribute('aria-pressed', String(isLinked));
                linkFieldsBtn.title = isLinked
                    ? 'Fields shared across stages (click to unlink)'
                    : 'Fields independent per stage (click to link)';
                const icon = linkFieldsBtn.querySelector('i');
                if (icon) {
                    icon.className = `fa-solid ${isLinked ? 'fa-link' : 'fa-link-slash'}`;
                }
                // Refresh field checkboxes to show current selection
                updateStageConfig();
            }),
        );
    }

    // Field checkbox events
    bindFieldEvents(container, cleanups);

    // Prompt events
    bindPromptEvents(container, cleanups);

    // Schema events
    bindSchemaEvents(container, cleanups);

    // Preview button
    bindPreviewEvents(container, cleanups, DOMPurify);

    // Preset manage buttons
    bindPresetManageEvents(container, cleanups);

    return () => {
        cleanups.forEach((fn) => fn());
    };
}

// =============================================================================
// FIELD EVENTS
// =============================================================================

function bindFieldEvents(
    container: HTMLElement,
    cleanups: Array<() => void>,
): void {
    const fieldsContainer = $(`#${MODULE_NAME}_fields_container`, container);
    if (!fieldsContainer) return;

    // Field checkbox change
    cleanups.push(
        on(fieldsContainer, 'change', (e) => {
            const target = e.target as HTMLInputElement;
            if (!target.classList.contains('cr-field-checkbox')) return;

            const fieldKey = target.dataset.field;
            if (!fieldKey) return;

            if (target.dataset.index !== undefined) {
                // Child checkbox (alternate greeting)
                const index = parseInt(target.dataset.index, 10);
                const selection = getCurrentFieldSelection();
                const current = Array.isArray(selection[fieldKey])
                    ? [...(selection[fieldKey] as number[])]
                    : [];

                if (target.checked) {
                    if (!current.includes(index)) current.push(index);
                } else {
                    const idx = current.indexOf(index);
                    if (idx !== -1) current.splice(idx, 1);
                }

                toggleField(
                    fieldKey,
                    current.length > 0 ? current.sort((a, b) => a - b) : false,
                );
            } else if (target.classList.contains('cr-field-checkbox--parent')) {
                // Parent checkbox - toggle all children
                const fieldItem = target.closest('.cr-field-group');
                if (!fieldItem) return;

                const children = $$(
                    '.cr-field-checkbox--child',
                    fieldItem,
                ) as HTMLInputElement[];

                if (target.checked) {
                    const indices = children.map((_, i) => i);
                    toggleField(fieldKey, indices);
                } else {
                    toggleField(fieldKey, false);
                }
            } else {
                // Regular field checkbox
                toggleField(fieldKey, target.checked);
            }

            updateFieldCheckboxes();
        }),
    );

    // Expand/collapse for field groups
    cleanups.push(
        on(fieldsContainer, 'click', (e) => {
            const target = e.target as HTMLElement;
            const expandBtn = target.closest('.cr-field-expand');
            if (!expandBtn) return;

            const group = expandBtn.closest('.cr-field-group');
            if (!group) return;

            group.classList.toggle('cr-field-group--expanded');
        }),
    );

    // View full field content button
    cleanups.push(
        on(fieldsContainer, 'click', async (e) => {
            const target = e.target as HTMLElement;
            const viewFullBtn = target.closest('.cr-field-preview__more');
            if (!viewFullBtn) return;

            const fieldKey = (viewFullBtn as HTMLElement).dataset.field;
            if (!fieldKey) return;

            const state = getState();
            if (!state.character) return;

            const fields = getPopulatedFields(state.character);
            const field = fields.find((f) => f.key === fieldKey);
            if (!field) return;

            popup.alert(
                field.label,
                `<pre class="cr-popup-preview">${SillyTavern.libs.DOMPurify.sanitize(field.value)}</pre>`,
            );
        }),
    );

    // Preview greeting button
    cleanups.push(
        on(fieldsContainer, 'click', async (e) => {
            const target = e.target as HTMLElement;
            const previewBtn = target.closest('.cr-field-preview-btn');
            if (!previewBtn) return;

            const fieldKey = (previewBtn as HTMLElement).dataset.field;
            const indexStr = (previewBtn as HTMLElement).dataset.index;
            if (!fieldKey || indexStr === undefined) return;

            const state = getState();
            if (!state.character) return;

            const fields = getPopulatedFields(state.character);
            const field = fields.find((f) => f.key === fieldKey);
            if (!field || !Array.isArray(field.rawValue)) return;

            const index = parseInt(indexStr, 10);
            const greeting = field.rawValue[index];
            if (!greeting) return;

            popup.alert(
                `Greeting ${index + 1}`,
                `<pre class="cr-popup-preview">${SillyTavern.libs.DOMPurify.sanitize(greeting)}</pre>`,
            );
        }),
    );
}

// =============================================================================
// PROMPT EVENTS
// =============================================================================

function bindPromptEvents(
    container: HTMLElement,
    cleanups: Array<() => void>,
): void {
    const promptTextarea = $(
        `#${MODULE_NAME}_prompt`,
        container,
    ) as HTMLTextAreaElement;

    if (promptTextarea) {
        const updatePrompt = SillyTavern.libs.lodash.debounce(
            (value: string) => {
                const state = getState();
                updateStateConfig(state.activeStage, {
                    customPrompt: value,
                    promptPresetId: null, // Clear preset when editing
                });
                updatePromptTokenCount(value);
            },
            300,
        );
        addPendingInput(updatePrompt);

        cleanups.push(
            on(promptTextarea, 'input', () => {
                updatePrompt(promptTextarea.value);
            }),
        );

        // Clean up this specific debounce when component is unbound
        cleanups.push(() => {
            updatePrompt.cancel();
            removePendingInput(updatePrompt);
        });

        // Initial token count
        updatePromptTokenCount(promptTextarea.value);
    }

    // Prompt preset dropdown
    const promptSelect = $(
        `#${MODULE_NAME}_prompt_select`,
        container,
    ) as HTMLSelectElement;
    if (promptSelect) {
        cleanups.push(
            on(promptSelect, 'change', () => {
                const state = getState();
                const presetId = promptSelect.value || null;

                updateStateConfig(state.activeStage, {
                    promptPresetId: presetId,
                    customPrompt: '', // Clear custom when selecting preset
                });

                // Update textarea with preset content or clear it
                if (promptTextarea) {
                    if (presetId) {
                        const preset = getPromptPreset(presetId);
                        if (preset) {
                            promptTextarea.value = preset.prompt;
                            updatePromptTokenCount(preset.prompt);
                        }
                    } else {
                        // "Custom" selected - clear textarea for fresh start
                        promptTextarea.value = '';
                        updatePromptTokenCount('');
                    }
                }
            }),
        );
    }

    // Save prompt as preset
    const savePromptBtn = $(`#${MODULE_NAME}_save_prompt`, container);
    if (savePromptBtn) {
        cleanups.push(
            on(savePromptBtn, 'click', async () => {
                const state = getState();
                const promptText = promptTextarea?.value || '';

                if (!promptText.trim()) {
                    toast.warning('Enter a prompt first');
                    return;
                }

                const stageConfig = state.stageConfigs[state.activeStage];
                const currentPreset = stageConfig?.promptPresetId
                    ? getPromptPreset(stageConfig.promptPresetId)
                    : null;

                // If we have a custom (non-builtin) preset selected, update it
                if (currentPreset && !currentPreset.isBuiltin) {
                    updatePromptPreset(currentPreset.id, {
                        prompt: promptText,
                    });
                    toast.success(`Updated preset "${currentPreset.name}"`);
                    updateStageConfig();
                    return;
                }

                // Otherwise create a new preset
                const existingNames = presetRegistry
                    .getPromptPresets()
                    .map((p) => p.name);
                const defaultName = generateUniqueName(
                    `${STAGE_LABELS[state.activeStage]} Custom`,
                    existingNames,
                );

                const name = await popup.input(
                    'Save Prompt Preset',
                    'Enter a name for this preset:',
                    defaultName,
                );

                if (!name) return;

                const preset = savePromptPreset({
                    name: name.trim(),
                    stages: [state.activeStage],
                    prompt: promptText,
                });

                // Switch to the new preset
                updateStateConfig(state.activeStage, {
                    promptPresetId: preset.id,
                    customPrompt: '', // Clear custom since we're using the preset
                });

                toast.success(`Saved preset "${preset.name}"`);

                // Refresh to show the new preset selected
                updateStageConfig();
            }),
        );
    }
}

// =============================================================================
// SCHEMA EVENTS
// =============================================================================

function bindSchemaEvents(
    container: HTMLElement,
    cleanups: Array<() => void>,
): void {
    // Schema toggle
    const schemaToggle = $(
        `#${MODULE_NAME}_use_schema`,
        container,
    ) as HTMLInputElement;
    const schemaSection = $(`#${MODULE_NAME}_schema_section`, container);
    if (schemaToggle && schemaSection) {
        cleanups.push(
            on(schemaToggle, 'change', () => {
                const state = getState();
                updateStateConfig(state.activeStage, {
                    useStructuredOutput: schemaToggle.checked,
                });
                schemaSection.classList.toggle(
                    'cr-hidden',
                    !schemaToggle.checked,
                );
            }),
        );
    }

    // Schema textarea
    const schemaTextarea = $(
        `#${MODULE_NAME}_schema`,
        container,
    ) as HTMLTextAreaElement;
    if (schemaTextarea) {
        const updateSchema = SillyTavern.libs.lodash.debounce(
            (value: string) => {
                const state = getState();
                updateStateConfig(state.activeStage, {
                    customSchema: value,
                    schemaPresetId: null,
                });
            },
            300,
        );
        addPendingInput(updateSchema);

        cleanups.push(
            on(schemaTextarea, 'input', () => {
                updateSchema(schemaTextarea.value);
            }),
        );

        // Clean up this specific debounce when component is unbound
        cleanups.push(() => {
            updateSchema.cancel();
            removePendingInput(updateSchema);
        });
    }

    // Schema preset dropdown
    const schemaSelect = $(
        `#${MODULE_NAME}_schema_select`,
        container,
    ) as HTMLSelectElement;
    if (schemaSelect && schemaTextarea) {
        cleanups.push(
            on(schemaSelect, 'change', () => {
                const state = getState();
                const presetId = schemaSelect.value || null;

                updateStateConfig(state.activeStage, {
                    schemaPresetId: presetId,
                    customSchema: '', // Clear custom when selecting preset
                });

                // Update textarea with preset content or clear it
                if (presetId) {
                    const preset = getSchemaPreset(presetId);
                    if (preset) {
                        schemaTextarea.value = JSON.stringify(
                            preset.schema,
                            null,
                            2,
                        );
                    }
                } else {
                    // "Custom" selected - clear textarea for fresh start
                    schemaTextarea.value = '';
                }
            }),
        );
    }

    // Generate schema button
    const generateBtn = $(`#${MODULE_NAME}_generate_schema`, container);
    if (generateBtn && schemaTextarea) {
        cleanups.push(
            on(generateBtn, 'click', async () => {
                const description = await popup.input(
                    'Generate JSON Schema',
                    'Describe the structure you want (e.g., "rating 1-10, list of issues, summary"):',
                    '',
                );

                if (!description) return;

                // Show loading state
                const originalText = generateBtn.innerHTML;
                generateBtn.innerHTML =
                    '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
                (generateBtn as HTMLButtonElement).disabled = true;

                try {
                    const result =
                        await generateSchemaFromDescription(description);

                    if (result.success && result.schema) {
                        // Put generated schema into textarea as custom
                        schemaTextarea.value = result.schema;

                        // Update state to use custom schema (clear any preset selection)
                        const state = getState();
                        updateStateConfig(state.activeStage, {
                            customSchema: result.schema,
                            schemaPresetId: null,
                        });

                        // Clear the preset dropdown selection
                        const schemaSelectInner = $(
                            `#${MODULE_NAME}_schema_select`,
                            container,
                        ) as HTMLSelectElement | null;
                        if (schemaSelectInner) {
                            schemaSelectInner.value = '';
                        }

                        toast.success(
                            'Schema generated! Review and save as preset if desired.',
                        );
                    } else {
                        toast.error(
                            result.error || 'Failed to generate schema',
                        );
                        // Still show partial result if available
                        if (result.schema) {
                            schemaTextarea.value = result.schema;
                        }
                    }
                } catch (error) {
                    toast.error(
                        `Generation failed: ${(error as Error).message}`,
                    );
                } finally {
                    // Restore button state
                    generateBtn.innerHTML = originalText;
                    (generateBtn as HTMLButtonElement).disabled = false;
                }
            }),
        );
    }

    // Validate schema button
    const validateBtn = $(`#${MODULE_NAME}_validate_schema`, container);
    if (validateBtn && schemaTextarea) {
        cleanups.push(
            on(validateBtn, 'click', () => {
                try {
                    JSON.parse(schemaTextarea.value);
                    toast.success('Valid JSON');
                } catch (error) {
                    toast.error(`Invalid JSON: ${(error as Error).message}`);
                }
            }),
        );
    }

    // Format schema button
    const formatBtn = $(`#${MODULE_NAME}_format_schema`, container);
    if (formatBtn && schemaTextarea) {
        cleanups.push(
            on(formatBtn, 'click', () => {
                try {
                    const parsed = JSON.parse(schemaTextarea.value);
                    schemaTextarea.value = JSON.stringify(parsed, null, 2);
                    toast.success('Formatted');
                } catch (error) {
                    toast.error(`Invalid JSON: ${(error as Error).message}`);
                }
            }),
        );
    }

    // Save schema as preset
    const saveSchemaBtn = $(`#${MODULE_NAME}_save_schema`, container);
    if (saveSchemaBtn && schemaTextarea) {
        cleanups.push(
            on(saveSchemaBtn, 'click', async () => {
                const state = getState();
                const schemaText = schemaTextarea.value || '';

                if (!schemaText.trim()) {
                    toast.warning('Enter a schema first');
                    return;
                }

                // Validate JSON first
                let parsed;
                try {
                    parsed = JSON.parse(schemaText);
                } catch (error) {
                    toast.error(`Invalid JSON: ${(error as Error).message}`);
                    return;
                }

                const stageConfig = state.stageConfigs[state.activeStage];
                const currentPreset = stageConfig?.schemaPresetId
                    ? getSchemaPreset(stageConfig.schemaPresetId)
                    : null;

                // If we have a custom (non-builtin) preset selected, update it
                if (currentPreset && !currentPreset.isBuiltin) {
                    updateSchemaPreset(currentPreset.id, { schema: parsed });
                    toast.success(`Updated preset "${currentPreset.name}"`);
                    updateStageConfig();
                    return;
                }

                // Otherwise create a new preset
                const existingNames = presetRegistry
                    .getSchemaPresets()
                    .map((p) => p.name);
                const defaultName = generateUniqueName(
                    `${STAGE_LABELS[state.activeStage]} Schema`,
                    existingNames,
                );

                const name = await popup.input(
                    'Save Schema Preset',
                    'Enter a name for this schema preset:',
                    defaultName,
                );

                if (!name) return;

                const preset = saveSchemaPreset({
                    name: name.trim(),
                    stages: [state.activeStage],
                    schema: parsed,
                });

                // Switch to the new preset
                updateStateConfig(state.activeStage, {
                    schemaPresetId: preset.id,
                    customSchema: '', // Clear custom since we're using the preset
                });

                toast.success(`Saved preset "${preset.name}"`);

                // Refresh to show the new preset selected
                updateStageConfig();
            }),
        );
    }
}

// =============================================================================
// PREVIEW EVENTS
// =============================================================================

function bindPreviewEvents(
    container: HTMLElement,
    cleanups: Array<() => void>,
    DOMPurify: typeof SillyTavern.libs.DOMPurify,
): void {
    const previewBtn = $(`#${MODULE_NAME}_preview`, container);
    if (previewBtn) {
        cleanups.push(
            on(previewBtn, 'click', async () => {
                const state = getState();
                if (!state.character) {
                    toast.warning('Select a character first');
                    return;
                }

                const summary = buildCharacterSummary(
                    state.character,
                    state.selectedFields,
                );

                // Include guidance in preview if present
                let preview = summary;
                if (state.userGuidance.trim()) {
                    preview += `\n\n---\n\n## USER GUIDANCE\n\n${state.userGuidance}`;
                }

                await popup.alert(
                    'Prompt Preview',
                    `<div class="cr-preview-content"><pre>${DOMPurify.sanitize(preview)}</pre></div>`,
                );
            }),
        );
    }
}

// =============================================================================
// PRESET MANAGE EVENTS
// =============================================================================

function bindPresetManageEvents(
    container: HTMLElement,
    cleanups: Array<() => void>,
): void {
    const manageBtns = $$('.cr-preset-manage-btn', container);
    for (const btn of manageBtns) {
        cleanups.push(
            on(btn, 'click', () => {
                const type = (btn as HTMLElement).dataset.type as
                    | 'prompt'
                    | 'schema';

                openDrawerWithList(type, {
                    onSelect: (preset) => {
                        // When a preset is selected from the list, apply it
                        const state = getState();
                        if (type === 'prompt') {
                            updateStateConfig(state.activeStage, {
                                promptPresetId: preset.id,
                                customPrompt: '',
                            });
                        } else {
                            updateStateConfig(state.activeStage, {
                                schemaPresetId: preset.id,
                                customSchema: '',
                            });
                        }
                        updateStageConfig();
                    },
                    onUpdate: () => {
                        // When presets are modified, refresh the dropdown
                        updateStageConfig();
                    },
                });
            }),
        );
    }
}
