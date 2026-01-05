// src/ui/components/stage-config.ts
// =============================================================================
// STAGE CONFIGURATION COMPONENT
// =============================================================================

import {
    MODULE_NAME,
    STAGE_LABELS,
    STAGE_ICONS,
    getTokenCount,
    getTokenCountsKeyed,
    popup,
    toast,
} from '../../shared';
import {
    getState,
    updateStageConfig as updateStateConfig,
    toggleField,
    getCurrentFieldSelection,
    areStagesLinked,
    toggleStageFieldLinking,
    setUserGuidance,
} from '../../state';
import {
    getPromptPresetsForStage,
    getSchemaPresetsForStage,
    getPromptPreset,
    getSchemaPreset,
    savePromptPreset,
} from '../../data';
import { getPopulatedFields, buildCharacterSummary } from '../../domain';
import { $, $$, on, formatTokenCount, cx } from './base';
import { openDrawerForCreate, openDrawerForEdit } from './preset-drawer';
import type { StageName, PopulatedField } from '../../types';

// =============================================================================
// HTML TEMPLATES
// =============================================================================

function renderFieldSelector(): string {
    const state = getState();

    if (!state.character) {
        return `
            <div class="ct-empty">
                <i class="fa-solid fa-user-slash ct-empty__icon"></i>
                <div class="ct-empty__title">No character selected</div>
                <div class="ct-empty__text">Select a character to see available fields</div>
            </div>
        `;
    }

    const fields = getPopulatedFields(state.character);

    if (fields.length === 0) {
        return `
            <div class="ct-empty">
                <i class="fa-solid fa-file-circle-question ct-empty__icon"></i>
                <div class="ct-empty__title">No fields</div>
                <div class="ct-empty__text">This character has no populated fields</div>
            </div>
        `;
    }

    // Trigger async token loading after render
    requestAnimationFrame(() => loadFieldTokens(fields));

    return `
        <div class="ct-field-list ct-scrollable">
            ${fields.map((field) => renderFieldItem(field)).join('')}
        </div>
    `;
}

/**
 * Load token counts for fields and update the display.
 */
async function loadFieldTokens(fields: PopulatedField[]): Promise<void> {
    const items = fields
        .filter((f) => f.key !== 'alternate_greetings') // Skip grouped fields
        .map((f) => ({ key: f.key, text: f.value }));

    if (items.length === 0) return;

    const results = await getTokenCountsKeyed(items);

    // Update each token display element
    for (const { key, tokens } of results) {
        const el = $(`.ct-field-tokens[data-field="${key}"]`);
        if (el) {
            el.textContent = formatTokenCount(tokens);
        }
    }
}

function renderFieldItem(field: PopulatedField): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const selection = getCurrentFieldSelection();
    const isSelected = field.key in selection && selection[field.key] !== false;

    // Handle alternate_greetings specially
    if (field.key === 'alternate_greetings' && Array.isArray(field.rawValue)) {
        const greetings = field.rawValue as string[];
        const selectedIndices = Array.isArray(selection[field.key])
            ? (selection[field.key] as number[])
            : [];
        const allSelected = selectedIndices.length === greetings.length;

        return `
            <div class="ct-field-group ct-field-group--expandable" data-field="${field.key}">
                <div class="ct-field-item ct-field-item--parent">
                    <label class="ct-field-label">
                        <input type="checkbox"
                               class="ct-field-checkbox ct-field-checkbox--parent"
                               data-field="${field.key}"
                               ${allSelected ? 'checked' : ''}
                               ${selectedIndices.length > 0 && !allSelected ? 'indeterminate' : ''} />
                        <span class="ct-field-name">${DOMPurify.sanitize(field.label)}</span>
                    </label>
                    <span class="ct-field-count">${greetings.length} greetings</span>
                    <button class="ct-field-expand" type="button" aria-label="Expand">
                        <i class="fa-solid fa-chevron-down"></i>
                    </button>
                </div>
                <div class="ct-field-children">
                    ${greetings
                        .map(
                            (greeting, i) => `
                        <div class="ct-field-item ct-field-item--child">
                            <label class="ct-field-label">
                                <input type="checkbox"
                                       class="ct-field-checkbox ct-field-checkbox--child"
                                       data-field="${field.key}"
                                       data-index="${i}"
                                       ${selectedIndices.includes(i) ? 'checked' : ''} />
                                <span class="ct-field-name">Greeting ${i + 1}</span>
                            </label>
                            <button class="ct-field-preview-btn" type="button" data-field="${field.key}" data-index="${i}" title="Preview greeting">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                        </div>
                    `,
                        )
                        .join('')}
                </div>
            </div>
        `;
    }

    // Truncate preview text for display (shorter to fit nicely)
    const MAX_PREVIEW = 150;
    const previewText =
        field.value.length > MAX_PREVIEW
            ? field.value.substring(0, MAX_PREVIEW).trim() + '…'
            : field.value;

    return `
        <div class="ct-field-group ct-field-group--expandable" data-field="${field.key}">
            <div class="ct-field-item ct-field-item--has-preview">
                <label class="ct-field-label">
                    <input type="checkbox"
                           class="ct-field-checkbox"
                           data-field="${field.key}"
                           ${isSelected ? 'checked' : ''} />
                    <span class="ct-field-name">${DOMPurify.sanitize(field.label)}</span>
                </label>
                <span class="ct-field-tokens" data-field="${field.key}">${formatTokenCount(field.tokens)}</span>
                <button class="ct-field-expand" type="button" aria-label="Expand field preview">
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
            </div>
            <div class="ct-field-preview">
                <pre class="ct-field-preview__text">${DOMPurify.sanitize(previewText)}</pre>
                <button class="ct-field-preview__more" type="button" data-field="${field.key}" title="View full content in popup">
                    <i class="fa-solid fa-expand"></i>
                    <span>View full content</span>
                </button>
            </div>
        </div>
    `;
}

function renderPresetDropdown(
    type: 'prompt' | 'schema',
    stage: StageName,
    selectedId: string | null,
): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const presets =
        type === 'prompt'
            ? getPromptPresetsForStage(stage)
            : getSchemaPresetsForStage(stage);

    const customId = `${MODULE_NAME}_${type}_select`;

    return `
        <div class="ct-preset-row">
            <select id="${customId}" class="ct-select text_pole" aria-label="${type} preset">
                <option value="">Custom</option>
                ${presets
                    .map(
                        (p) => `
                    <option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>
                        ${DOMPurify.sanitize(p.name)}${p.isBuiltin ? '' : ' ✦'}
                    </option>
                `,
                    )
                    .join('')}
            </select>
            <div class="ct-preset-row__actions">
                <button class="ct-preset-manage ct-preset-edit-btn"
                        data-type="${type}"
                        type="button"
                        title="Edit selected preset"
                        ${!selectedId ? 'disabled' : ''}>
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="ct-preset-manage ct-preset-new-btn"
                        data-type="${type}"
                        type="button"
                        title="Create new ${type} preset">
                    <i class="fa-solid fa-plus"></i>
                </button>
            </div>
        </div>
    `;
}

/**
 * Render stage configuration panel.
 */
export function renderStageConfig(): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const state = getState();
    const stage = state.activeStage;
    const config = state.stageConfigs[stage];

    // Get current prompt text
    let promptText = config.customPrompt;
    if (!promptText && config.promptPresetId) {
        const preset = getPromptPreset(config.promptPresetId);
        if (preset) promptText = preset.prompt;
    }

    // Get current schema text
    let schemaText = config.customSchema;
    if (!schemaText && config.schemaPresetId) {
        const preset = getSchemaPreset(config.schemaPresetId);
        if (preset) schemaText = JSON.stringify(preset.schema, null, 2);
    }

    return `
        <section class="ct-section ct-stage-config" aria-label="Stage Configuration">
            <div class="ct-section__header">
                <h3 class="ct-section__title">
                    <i class="fa-solid ${STAGE_ICONS[stage]}"></i>
                    ${STAGE_LABELS[stage]} Configuration
                </h3>
            </div>

            <!-- Field Selection -->
            <div class="ct-stack ct-stack--tight">
                <div class="ct-row ct-row--between">
                    <div class="ct-row">
                        <i class="fa-solid fa-list-check ct-text-accent"></i>
                        <span class="ct-font-medium ct-text-sm">Fields to Include</span>
                    </div>
                    <button id="${MODULE_NAME}_link_fields"
                            class="menu_button menu_button--icon menu_button--sm menu_button--ghost ${areStagesLinked() ? 'ct-active' : ''}"
                            type="button"
                            title="${areStagesLinked() ? 'Fields shared across stages (click to unlink)' : 'Fields independent per stage (click to link)'}"
                            aria-pressed="${areStagesLinked()}">
                        <i class="fa-solid ${areStagesLinked() ? 'fa-link' : 'fa-link-slash'}"></i>
                    </button>
                </div>
                <div id="${MODULE_NAME}_fields_container">
                    ${renderFieldSelector()}
                </div>
            </div>

            <!-- Prompt Configuration -->
            <div class="ct-stack ct-stack--tight ct-mt-4">
                <div class="ct-row ct-row--between">
                    <div class="ct-row">
                        <i class="fa-solid fa-message ct-text-accent"></i>
                        <span class="ct-font-medium ct-text-sm">Prompt</span>
                    </div>
                    <div class="ct-row ct-gap-1">
                        <button id="${MODULE_NAME}_save_prompt"
                                class="menu_button menu_button--icon menu_button--sm menu_button--ghost"
                                type="button"
                                title="Save as preset"
                                aria-label="Save as preset">
                            <i class="fa-solid fa-floppy-disk"></i>
                        </button>
                        ${renderPresetDropdown('prompt', stage, config.promptPresetId)}
                    </div>
                </div>
                <div class="ct-form-group">
                    <textarea id="${MODULE_NAME}_prompt"
                              placeholder="Enter instructions for this stage..."
                              rows="6">${DOMPurify.sanitize(promptText)}</textarea>
                    <div class="ct-form-group__hint ct-text-right">
                        <span id="${MODULE_NAME}_prompt_tokens">Calculating...</span>
                    </div>
                </div>
            </div>

            <!-- Structured Output Toggle -->
            <div class="ct-stack ct-stack--tight ct-mt-4">
                <label class="ct-checkbox">
                    <input type="checkbox"
                           id="${MODULE_NAME}_use_schema"
                           ${config.useStructuredOutput ? 'checked' : ''} />
                    <span>Use Structured Output (JSON Schema)</span>
                </label>

                <div id="${MODULE_NAME}_schema_section"
                     class="${cx(!config.useStructuredOutput && 'ct-hidden')} ct-stack ct-stack--tight ct-mt-2">
                    <div class="ct-row ct-row--between">
                        <div class="ct-row">
                            <i class="fa-solid fa-code ct-text-accent"></i>
                            <span class="ct-font-medium ct-text-sm">JSON Schema</span>
                        </div>
                        ${renderPresetDropdown('schema', stage, config.schemaPresetId)}
                    </div>
                    <textarea id="${MODULE_NAME}_schema"
                              class="ct-textarea--code"
                              placeholder='{"name": "MySchema", "strict": true, "value": {...}}'
                              rows="8">${DOMPurify.sanitize(schemaText)}</textarea>
                    <div class="ct-button-group">
                        <button id="${MODULE_NAME}_validate_schema"
                                class="menu_button menu_button--sm"
                                type="button">
                            <i class="fa-solid fa-check"></i>
                            Validate
                        </button>
                        <button id="${MODULE_NAME}_format_schema"
                                class="menu_button menu_button--sm"
                                type="button">
                            <i class="fa-solid fa-indent"></i>
                            Format
                        </button>
                    </div>
                </div>
            </div>

            <!-- User Guidance -->
            <div class="ct-stack ct-stack--tight ct-mt-4">
                <div class="ct-row">
                    <i class="fa-solid fa-compass ct-text-accent"></i>
                    <span class="ct-font-medium ct-text-sm">Guidance</span>
                    <span class="ct-text-xs ct-text-dim">(optional focus or constraints)</span>
                </div>
                <textarea id="${MODULE_NAME}_guidance"
                          class="ct-textarea--compact"
                          placeholder="e.g., 'Focus on dialogue quality' or 'Maintain a dark, brooding tone'"
                          rows="2">${DOMPurify.sanitize(state.userGuidance)}</textarea>
            </div>

            <!-- Preview -->
            <div class="ct-mt-4">
                <button id="${MODULE_NAME}_preview"
                        class="menu_button menu_button--full"
                        type="button"
                        ${!state.character ? 'disabled' : ''}>
                    <i class="fa-solid fa-eye"></i>
                    Preview Full Prompt
                </button>
            </div>
        </section>
    `;
}

/**
 * Refresh a preset dropdown with current options.
 */
function refreshPresetDropdown(
    type: 'prompt' | 'schema',
    stage: StageName,
    selectedId: string | null,
): void {
    const selectId = `${MODULE_NAME}_${type}_select`;
    const select = $(`#${selectId}`) as HTMLSelectElement;
    if (!select) return;

    const DOMPurify = SillyTavern.libs.DOMPurify;
    const presets =
        type === 'prompt'
            ? getPromptPresetsForStage(stage)
            : getSchemaPresetsForStage(stage);

    // Build new options HTML
    const optionsHtml = `
        <option value="">Custom</option>
        ${presets
            .map(
                (p) => `
            <option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>
                ${DOMPurify.sanitize(p.name)}${p.isBuiltin ? '' : ' ✦'}
            </option>
        `,
            )
            .join('')}
    `;

    select.innerHTML = optionsHtml;
}

/**
 * Update stage config display.
 */
export function updateStageConfig(): void {
    const container = $('.ct-stage-config');
    if (!container) return;

    const state = getState();
    const stage = state.activeStage;
    const config = state.stageConfigs[stage];

    // Update header
    const headerTitle = container.querySelector('.ct-section__title');
    if (headerTitle) {
        headerTitle.innerHTML = `
            <i class="fa-solid ${STAGE_ICONS[stage]}"></i>
            ${STAGE_LABELS[stage]} Configuration
        `;
    }

    // Update fields
    const fieldsContainer = $(`#${MODULE_NAME}_fields_container`);
    if (fieldsContainer) {
        fieldsContainer.innerHTML = renderFieldSelector();
    }

    // Update prompt
    const promptTextarea = $(`#${MODULE_NAME}_prompt`) as HTMLTextAreaElement;
    if (promptTextarea) {
        let promptText = config.customPrompt;
        if (!promptText && config.promptPresetId) {
            const preset = getPromptPreset(config.promptPresetId);
            if (preset) promptText = preset.prompt;
        }
        promptTextarea.value = promptText;
        updateTokenCount(promptTextarea.value);
    }

    // Refresh prompt preset dropdown (re-render options, not just value)
    refreshPresetDropdown('prompt', stage, config.promptPresetId);

    // Update schema toggle
    const schemaToggle = $(`#${MODULE_NAME}_use_schema`) as HTMLInputElement;
    if (schemaToggle) {
        schemaToggle.checked = config.useStructuredOutput;
    }

    // Update schema section visibility
    const schemaSection = $(`#${MODULE_NAME}_schema_section`);
    if (schemaSection) {
        schemaSection.classList.toggle(
            'ct-hidden',
            !config.useStructuredOutput,
        );
    }

    // Refresh schema preset dropdown
    refreshPresetDropdown('schema', stage, config.schemaPresetId);

    // Update schema textarea
    const schemaTextarea = $(`#${MODULE_NAME}_schema`) as HTMLTextAreaElement;
    if (schemaTextarea) {
        let schemaText = config.customSchema;
        if (!schemaText && config.schemaPresetId) {
            const preset = getSchemaPreset(config.schemaPresetId);
            if (preset) schemaText = JSON.stringify(preset.schema, null, 2);
        }
        schemaTextarea.value = schemaText;
    }
}

/**
 * Update token count display.
 */
async function updateTokenCount(text: string): Promise<void> {
    const countEl = $(`#${MODULE_NAME}_prompt_tokens`);
    if (!countEl) return;

    // Use centralized token counting with caching
    const count = await getTokenCount(text);
    if (count !== null) {
        countEl.textContent = `~${count} tokens`;
    } else {
        // Fallback to rough estimate if token counting unavailable
        countEl.textContent = `~${Math.ceil(text.length / 4)} tokens`;
    }
}

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
                linkFieldsBtn.classList.toggle('ct-active', isLinked);
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

    // Field checkboxes
    const fieldsContainer = $(`#${MODULE_NAME}_fields_container`, container);
    if (fieldsContainer) {
        cleanups.push(
            on(fieldsContainer, 'change', (e) => {
                const target = e.target as HTMLInputElement;
                if (!target.classList.contains('ct-field-checkbox')) return;

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
                        current.length > 0
                            ? current.sort((a, b) => a - b)
                            : false,
                    );
                } else if (
                    target.classList.contains('ct-field-checkbox--parent')
                ) {
                    // Parent checkbox - toggle all children
                    const fieldItem = target.closest('.ct-field-group');
                    if (!fieldItem) return;

                    const children = $$(
                        '.ct-field-checkbox--child',
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
                const expandBtn = target.closest('.ct-field-expand');
                if (!expandBtn) return;

                const group = expandBtn.closest('.ct-field-group');
                if (!group) return;

                group.classList.toggle('ct-field-group--expanded');
            }),
        );

        // View full field content button
        cleanups.push(
            on(fieldsContainer, 'click', async (e) => {
                const target = e.target as HTMLElement;
                const viewFullBtn = target.closest('.ct-field-preview__more');
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
                    `<pre class="ct-popup-preview">${SillyTavern.libs.DOMPurify.sanitize(field.value)}</pre>`,
                );
            }),
        );

        // Preview greeting button
        cleanups.push(
            on(fieldsContainer, 'click', async (e) => {
                const target = e.target as HTMLElement;
                const previewBtn = target.closest('.ct-field-preview-btn');
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
                    `<pre class="ct-popup-preview">${SillyTavern.libs.DOMPurify.sanitize(greeting)}</pre>`,
                );
            }),
        );
    }

    // Prompt textarea
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
                updateTokenCount(value);
            },
            300,
        );

        cleanups.push(
            on(promptTextarea, 'input', () => {
                updatePrompt(promptTextarea.value);
            }),
        );

        // Initial token count
        updateTokenCount(promptTextarea.value);
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

                // Update textarea with preset content
                if (presetId) {
                    const preset = getPromptPreset(presetId);
                    if (preset && promptTextarea) {
                        promptTextarea.value = preset.prompt;
                        updateTokenCount(preset.prompt);
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

                const name = await popup.input(
                    'Save Prompt Preset',
                    'Enter a name for this preset:',
                    `${STAGE_LABELS[state.activeStage]} Custom`,
                );

                if (!name) return;

                const preset = savePromptPreset({
                    name: name.trim(),
                    stages: [state.activeStage],
                    prompt: promptText,
                });

                toast.success(`Saved preset "${preset.name}"`);

                // Refresh dropdown
                updateStageConfig();
            }),
        );
    }

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
                    'ct-hidden',
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

        cleanups.push(
            on(schemaTextarea, 'input', () => {
                updateSchema(schemaTextarea.value);
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

    // User guidance textarea
    const guidanceTextarea = $(
        `#${MODULE_NAME}_guidance`,
        container,
    ) as HTMLTextAreaElement;
    if (guidanceTextarea) {
        const updateGuidance = SillyTavern.libs.lodash.debounce(
            (value: string) => {
                setUserGuidance(value);
            },
            300,
        );

        cleanups.push(
            on(guidanceTextarea, 'input', () => {
                updateGuidance(guidanceTextarea.value);
            }),
        );
    }

    // Preview button
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
                    `<div class="ct-preview-content"><pre>${DOMPurify.sanitize(preview)}</pre></div>`,
                );
            }),
        );
    }

    // Preset Edit buttons (both prompt and schema)
    const editBtns = $$('.ct-preset-edit-btn', container);
    for (const btn of editBtns) {
        cleanups.push(
            on(btn, 'click', () => {
                const type = (btn as HTMLElement).dataset.type as
                    | 'prompt'
                    | 'schema';
                const selectId = `${MODULE_NAME}_${type}_select`;
                const select = $(
                    `#${selectId}`,
                    container,
                ) as HTMLSelectElement;
                const presetId = select?.value;

                if (!presetId) {
                    toast.warning('Select a preset first');
                    return;
                }

                openDrawerForEdit(type, presetId, {
                    onSave: () => {
                        // Refresh the dropdown and update state
                        updateStageConfig();
                    },
                });
            }),
        );
    }

    // Preset New buttons (both prompt and schema)
    const newBtns = $$('.ct-preset-new-btn', container);
    for (const btn of newBtns) {
        cleanups.push(
            on(btn, 'click', () => {
                const type = (btn as HTMLElement).dataset.type as
                    | 'prompt'
                    | 'schema';

                openDrawerForCreate(type, {
                    onSave: (preset) => {
                        // Select the newly created preset
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
                });
            }),
        );
    }

    // Update edit button states when dropdown changes
    const promptSelectForEdit = $(
        `#${MODULE_NAME}_prompt_select`,
        container,
    ) as HTMLSelectElement;
    const schemaSelectForEdit = $(
        `#${MODULE_NAME}_schema_select`,
        container,
    ) as HTMLSelectElement;

    const updateEditButtonStates = () => {
        const promptEditBtn = $(
            '.ct-preset-edit-btn[data-type="prompt"]',
            container,
        ) as HTMLButtonElement;
        const schemaEditBtn = $(
            '.ct-preset-edit-btn[data-type="schema"]',
            container,
        ) as HTMLButtonElement;

        if (promptEditBtn && promptSelectForEdit) {
            promptEditBtn.disabled = !promptSelectForEdit.value;
        }
        if (schemaEditBtn && schemaSelectForEdit) {
            schemaEditBtn.disabled = !schemaSelectForEdit.value;
        }
    };

    if (promptSelectForEdit) {
        cleanups.push(
            on(promptSelectForEdit, 'change', updateEditButtonStates),
        );
    }
    if (schemaSelectForEdit) {
        cleanups.push(
            on(schemaSelectForEdit, 'change', updateEditButtonStates),
        );
    }

    return () => {
        cleanups.forEach((fn) => fn());
    };
}

/**
 * Update field checkboxes state.
 */
function updateFieldCheckboxes(): void {
    const fieldsContainer = $(`#${MODULE_NAME}_fields_container`);
    if (!fieldsContainer) return;

    // Update parent checkboxes for groups
    const groups = $$('.ct-field-group', fieldsContainer);
    for (const group of groups) {
        const fieldKey = (group as HTMLElement).dataset.field;
        if (!fieldKey) continue;

        const parentCheckbox = $(
            '.ct-field-checkbox--parent',
            group,
        ) as HTMLInputElement;
        const childCheckboxes = $$(
            '.ct-field-checkbox--child',
            group,
        ) as HTMLInputElement[];

        if (!parentCheckbox) continue;

        const checkedCount = childCheckboxes.filter((c) => c.checked).length;
        const totalCount = childCheckboxes.length;

        if (checkedCount === 0) {
            parentCheckbox.checked = false;
            parentCheckbox.indeterminate = false;
        } else if (checkedCount === totalCount) {
            parentCheckbox.checked = true;
            parentCheckbox.indeterminate = false;
        } else {
            parentCheckbox.checked = false;
            parentCheckbox.indeterminate = true;
        }
    }
}
