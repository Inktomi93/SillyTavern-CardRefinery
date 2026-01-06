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
import { openDrawerWithList } from './preset-drawer';
import type { StageName, PopulatedField } from '../../types';

// =============================================================================
// INPUT DEBOUNCE TRACKING
// =============================================================================

// Track active debounced input handlers so we can flush them on close
type DebouncedFn = ReturnType<typeof SillyTavern.libs.lodash.debounce>;
let pendingInputDebounces: DebouncedFn[] = [];

/**
 * Flush all pending debounced input handlers.
 * Call this before forceSave to ensure all typed content is captured.
 */
export function flushPendingInputs(): void {
    for (const fn of pendingInputDebounces) {
        fn.flush();
    }
}

/**
 * Clear tracked debounces (call on cleanup).
 */
export function clearPendingInputs(): void {
    for (const fn of pendingInputDebounces) {
        fn.cancel();
    }
    pendingInputDebounces = [];
}

// =============================================================================
// HTML TEMPLATES
// =============================================================================

function renderFieldSelector(): string {
    const state = getState();

    if (!state.character) {
        return /* html */ `
            <div class="cr-empty">
                <i class="fa-solid fa-user-slash cr-empty__icon"></i>
                <div class="cr-empty__title">No character selected</div>
                <div class="cr-empty__text">Select a character to see available fields</div>
            </div>
        `;
    }

    const fields = getPopulatedFields(state.character);

    if (fields.length === 0) {
        return /* html */ `
            <div class="cr-empty">
                <i class="fa-solid fa-file-circle-question cr-empty__icon"></i>
                <div class="cr-empty__title">No fields</div>
                <div class="cr-empty__text">This character has no populated fields</div>
            </div>
        `;
    }

    // Trigger async token loading after render
    requestAnimationFrame(() => loadFieldTokens(fields));

    return /* html */ `
        <div class="cr-field-list cr-scrollable">
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
        const el = $(`.cr-field-tokens[data-field="${key}"]`);
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

        return /* html */ `
            <div class="cr-field-group cr-field-group--expandable" data-field="${field.key}">
                <div class="cr-field-item cr-field-item--parent">
                    <label class="cr-field-label">
                        <input type="checkbox"
                               class="cr-field-checkbox cr-field-checkbox--parent"
                               data-field="${field.key}"
                               ${allSelected ? 'checked' : ''}
                               ${selectedIndices.length > 0 && !allSelected ? 'indeterminate' : ''}/>
                        <span class="cr-field-name">${DOMPurify.sanitize(field.label)}</span>
                    </label>
                    <span class="cr-field-count">${greetings.length} greetings</span>
                    <button class="cr-field-expand" type="button" aria-label="Expand">
                        <i class="fa-solid fa-chevron-down"></i>
                    </button>
                </div>
                <div class="cr-field-children">
                    ${greetings
                        .map(
                            (greeting, i) => /* html */ `
                        <div class="cr-field-item cr-field-item--child">
                            <label class="cr-field-label">
                                <input type="checkbox"
                                       class="cr-field-checkbox cr-field-checkbox--child"
                                       data-field="${field.key}"
                                       data-index="${i}"
                                       ${selectedIndices.includes(i) ? 'checked' : ''}/>
                                <span class="cr-field-name">Greeting ${i + 1}</span>
                            </label>
                            <button class="cr-field-preview-btn" type="button" data-field="${field.key}" data-index="${i}" title="Preview greeting">
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

    return /* html */ `
        <div class="cr-field-group cr-field-group--expandable" data-field="${field.key}">
            <div class="cr-field-item cr-field-item--has-preview">
                <label class="cr-field-label">
                    <input type="checkbox"
                           class="cr-field-checkbox"
                           data-field="${field.key}"
                           ${isSelected ? 'checked' : ''}/>
                    <span class="cr-field-name">${DOMPurify.sanitize(field.label)}</span>
                </label>
                <span class="cr-field-tokens" data-field="${field.key}">${formatTokenCount(field.tokens)}</span>
                <button class="cr-field-expand" type="button" aria-label="Expand field preview">
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
            </div>
            <div class="cr-field-preview">
                <pre class="cr-field-preview__text">${DOMPurify.sanitize(previewText)}</pre>
                <button class="cr-field-preview__more" type="button" data-field="${field.key}" title="View full content in popup">
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
    const label = type === 'prompt' ? 'Preset:' : 'Schema:';

    return /* html */ `
        <div class="cr-preset-row">
            <span class="cr-preset-label">${label}</span>
            <select id="${customId}" class="cr-select text_pole" aria-label="${type} preset">
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
            <button class="cr-preset-manage-btn menu_button menu_button--icon menu_button--sm menu_button--ghost"
                    data-type="${type}"
                    type="button"
                    title="Manage ${type} presets">
                <i class="fa-solid fa-folder-open"></i>
            </button>
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

    return /* html */ `
        <section class="cr-section cr-stage-config" aria-label="Stage Configuration">
            <div class="cr-section__header">
                <h3 class="cr-section__title">
                    <i class="fa-solid ${STAGE_ICONS[stage]}"></i>
                    ${STAGE_LABELS[stage]} Configuration
                </h3>
            </div>

            <!-- Field Selection -->
            <div class="cr-stack cr-stack--tight">
                <div class="cr-row cr-row--between">
                    <div class="cr-row">
                        <i class="fa-solid fa-list-check cr-text-accent"></i>
                        <span class="cr-font-medium cr-text-sm">Fields to Include</span>
                    </div>
                    <button id="${MODULE_NAME}_link_fields"
                            class="menu_button menu_button--icon menu_button--sm menu_button--ghost ${areStagesLinked() ? 'cr-active' : ''}"
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
            <div class="cr-stack cr-stack--tight cr-mt-4">
                <div class="cr-row cr-row--between">
                    <div class="cr-row">
                        <i class="fa-solid fa-message cr-text-accent"></i>
                        <span class="cr-font-medium cr-text-sm">Prompt</span>
                    </div>
                    <div class="cr-row cr-gap-1">
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
                <div class="cr-form-group">
                    <textarea id="${MODULE_NAME}_prompt"
                              placeholder="Enter instructions for this stage..."
                              rows="6">${DOMPurify.sanitize(promptText)}</textarea>
                    <div class="cr-form-group__hint cr-text-right">
                        <span id="${MODULE_NAME}_prompt_tokens">Calculating...</span>
                    </div>
                </div>
            </div>

            <!-- Structured Output Toggle -->
            <div class="cr-stack cr-stack--tight cr-mt-4">
                <label class="cr-checkbox">
                    <input type="checkbox"
                           id="${MODULE_NAME}_use_schema"
                           ${config.useStructuredOutput ? 'checked' : ''}/>
                    <span>Use Structured Output (JSON Schema)</span>
                </label>

                <div id="${MODULE_NAME}_schema_section"
                     class="${cx(!config.useStructuredOutput && 'cr-hidden')} cr-stack cr-stack--tight cr-mt-2">
                    <div class="cr-row cr-row--between">
                        <div class="cr-row">
                            <i class="fa-solid fa-code cr-text-accent"></i>
                            <span class="cr-font-medium cr-text-sm">JSON Schema</span>
                        </div>
                        ${renderPresetDropdown('schema', stage, config.schemaPresetId)}
                    </div>
                    <textarea id="${MODULE_NAME}_schema"
                              class="cr-textarea--code"
                              placeholder='{"name": "MySchema", "strict": true, "value": {...}}'
                              rows="8">${DOMPurify.sanitize(schemaText)}</textarea>
                    <div class="cr-button-group">
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

            <!-- Preview -->
            <div class="cr-mt-4">
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
    const container = $('.cr-stage-config');
    if (!container) return;

    const state = getState();
    const stage = state.activeStage;
    const config = state.stageConfigs[stage];

    // Update header
    const headerTitle = container.querySelector('.cr-section__title');
    if (headerTitle) {
        headerTitle.innerHTML = /* html */ `
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
            'cr-hidden',
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

    // Update preview button disabled state
    const previewBtn = $(`#${MODULE_NAME}_preview`) as HTMLButtonElement;
    if (previewBtn) {
        previewBtn.disabled = !state.character;
    }

    // Update link fields button state
    const linkFieldsBtn = $(`#${MODULE_NAME}_link_fields`);
    if (linkFieldsBtn) {
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

    // Field checkboxes
    const fieldsContainer = $(`#${MODULE_NAME}_fields_container`, container);
    if (fieldsContainer) {
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
                        current.length > 0
                            ? current.sort((a, b) => a - b)
                            : false,
                    );
                } else if (
                    target.classList.contains('cr-field-checkbox--parent')
                ) {
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
        pendingInputDebounces.push(updatePrompt);

        cleanups.push(
            on(promptTextarea, 'input', () => {
                updatePrompt(promptTextarea.value);
            }),
        );

        // Clean up this specific debounce when component is unbound
        cleanups.push(() => {
            updatePrompt.cancel();
            const idx = pendingInputDebounces.indexOf(updatePrompt);
            if (idx !== -1) pendingInputDebounces.splice(idx, 1);
        });

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

                // Update textarea with preset content or clear it
                if (promptTextarea) {
                    if (presetId) {
                        const preset = getPromptPreset(presetId);
                        if (preset) {
                            promptTextarea.value = preset.prompt;
                            updateTokenCount(preset.prompt);
                        }
                    } else {
                        // "Custom" selected - clear textarea for fresh start
                        promptTextarea.value = '';
                        updateTokenCount('');
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
        pendingInputDebounces.push(updateSchema);

        cleanups.push(
            on(schemaTextarea, 'input', () => {
                updateSchema(schemaTextarea.value);
            }),
        );

        // Clean up this specific debounce when component is unbound
        cleanups.push(() => {
            updateSchema.cancel();
            const idx = pendingInputDebounces.indexOf(updateSchema);
            if (idx !== -1) pendingInputDebounces.splice(idx, 1);
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
                    `<div class="cr-preview-content"><pre>${DOMPurify.sanitize(preview)}</pre></div>`,
                );
            }),
        );
    }

    // Preset Manage buttons (opens drawer with full list)
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
    const groups = $$('.cr-field-group', fieldsContainer);
    for (const group of groups) {
        const fieldKey = (group as HTMLElement).dataset.field;
        if (!fieldKey) continue;

        const parentCheckbox = $(
            '.cr-field-checkbox--parent',
            group,
        ) as HTMLInputElement;
        const childCheckboxes = $$(
            '.cr-field-checkbox--child',
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
