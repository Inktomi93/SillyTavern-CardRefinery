// src/ui/components/preset-drawer.ts
// =============================================================================
// PRESET DRAWER - Slideout panel for preset management
// =============================================================================
//
// A modern drawer component that slides in from the right for editing presets.
// Provides a better UX than buried modals by being:
// - Contextual (can be triggered from anywhere presets are used)
// - Spacious (full-height panel for comfortable editing)
// - Integrated (includes create, edit, duplicate, and AI generation)
//
// =============================================================================

import {
    MODULE_NAME,
    STAGE_LABELS,
    STAGES,
    popup,
    log,
    toast,
} from '../../shared';
import {
    presetRegistry,
    validatePromptPreset,
    validateSchemaPreset,
} from '../../data';
import {
    validateSchema,
    formatSchema,
    generateSchemaFromDescription,
} from '../../domain/schema';
import { $, $$, on } from './base';
import type {
    PromptPreset,
    SchemaPreset,
    StageName,
    StructuredOutputSchema,
} from '../../types';

// =============================================================================
// TYPES
// =============================================================================

export type PresetType = 'prompt' | 'schema';
export type DrawerMode = 'create' | 'edit' | 'duplicate';

export interface DrawerState {
    isOpen: boolean;
    type: PresetType;
    mode: DrawerMode;
    preset: PromptPreset | SchemaPreset | null;
    activeTab: 'edit' | 'preview';
}

interface DrawerCallbacks {
    onSave?: (preset: PromptPreset | SchemaPreset) => void;
    onClose?: () => void;
}

// =============================================================================
// STATE
// =============================================================================

let drawerState: DrawerState = {
    isOpen: false,
    type: 'prompt',
    mode: 'create',
    preset: null,
    activeTab: 'edit',
};

let drawerCallbacks: DrawerCallbacks = {};
let cleanupFns: Array<() => void> = [];

// =============================================================================
// HTML TEMPLATES
// =============================================================================

function renderDrawer(): string {
    return `
        <div id="${MODULE_NAME}_preset_drawer" class="ct-drawer" aria-hidden="true">
            <div class="ct-drawer__backdrop"></div>
            <aside class="ct-drawer__panel" role="dialog" aria-label="Preset Editor">
                <div class="ct-drawer__content">
                    ${renderDrawerHeader()}
                    ${renderDrawerBody()}
                    ${renderDrawerFooter()}
                </div>
            </aside>
        </div>
    `;
}

function renderDrawerHeader(): string {
    const { type, mode, preset } = drawerState;

    let title = '';
    let icon = '';

    if (mode === 'create') {
        title = `New ${type === 'prompt' ? 'Prompt' : 'Schema'} Preset`;
        icon = 'fa-plus';
    } else if (mode === 'edit') {
        title = `Edit ${type === 'prompt' ? 'Prompt' : 'Schema'} Preset`;
        icon = 'fa-pen';
    } else {
        title = `Duplicate ${type === 'prompt' ? 'Prompt' : 'Schema'} Preset`;
        icon = 'fa-copy';
    }

    return `
        <header class="ct-drawer__header">
            <div class="ct-drawer__title">
                <i class="fa-solid ${icon} ct-text-accent"></i>
                <h3>${title}</h3>
                ${preset?.isBuiltin ? '<span class="ct-badge ct-badge--info ct-badge--small">builtin</span>' : ''}
            </div>
            <button id="${MODULE_NAME}_drawer_close"
                    class="menu_button menu_button--icon menu_button--ghost"
                    type="button"
                    aria-label="Close drawer">
                <i class="fa-solid fa-times"></i>
            </button>
        </header>
    `;
}

function renderDrawerBody(): string {
    const { type, mode, preset } = drawerState;
    const isBuiltinDuplicate = mode === 'duplicate' && preset?.isBuiltin;

    return `
        <div class="ct-drawer__body ct-scrollable">
            ${
                isBuiltinDuplicate
                    ? `
                <div class="ct-alert ct-alert--info ct-mb-3">
                    <i class="fa-solid fa-circle-info ct-alert__icon"></i>
                    <div class="ct-alert__content">
                        <div class="ct-alert__message">
                            Builtin presets cannot be modified. You're creating an editable copy.
                        </div>
                    </div>
                </div>
            `
                    : ''
            }
            ${renderNameField()}
            ${renderStagesField()}
            ${type === 'prompt' ? renderPromptEditor() : renderSchemaEditor()}
        </div>
    `;
}

function renderNameField(): string {
    const { preset, mode } = drawerState;
    const DOMPurify = SillyTavern.libs.DOMPurify;

    let defaultName = '';
    if (preset) {
        defaultName =
            mode === 'duplicate' ? `${preset.name} (Copy)` : preset.name;
    }

    return `
        <div class="ct-form-group">
            <label class="ct-label" for="${MODULE_NAME}_drawer_name">
                Name <span class="ct-required">*</span>
            </label>
            <input type="text"
                   id="${MODULE_NAME}_drawer_name"
                   class="ct-input text_pole"
                   value="${DOMPurify.sanitize(defaultName)}"
                   placeholder="Enter preset name..."
                   maxlength="100"
                   autocomplete="off" />
        </div>
    `;
}

function renderStagesField(): string {
    const { preset } = drawerState;
    const stages = preset?.stages || [];

    return `
        <div class="ct-form-group">
            <label class="ct-label">
                Applicable Stages
                <span class="ct-hint ct-text-dim">(empty = all stages)</span>
            </label>
            <div class="ct-stage-chips">
                ${STAGES.map(
                    (s) => `
                    <label class="ct-chip ${stages.length === 0 || stages.includes(s) ? 'ct-chip--active' : ''}">
                        <input type="checkbox"
                               name="drawer_stages"
                               value="${s}"
                               ${stages.length === 0 || stages.includes(s) ? 'checked' : ''} />
                        <span>${STAGE_LABELS[s]}</span>
                    </label>
                `,
                ).join('')}
            </div>
        </div>
    `;
}

function renderPromptEditor(): string {
    const { preset } = drawerState;
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const promptText = (preset as PromptPreset)?.prompt || '';

    return `
        <div class="ct-form-group ct-form-group--grow">
            <div class="ct-row ct-row--between">
                <label class="ct-label" for="${MODULE_NAME}_drawer_prompt">
                    Prompt Template <span class="ct-required">*</span>
                </label>
                <div class="ct-row ct-gap-1">
                    <button id="${MODULE_NAME}_drawer_prompt_vars"
                            class="menu_button menu_button--sm menu_button--ghost"
                            type="button"
                            title="View available variables">
                        <i class="fa-solid fa-code"></i>
                        Variables
                    </button>
                </div>
            </div>
            <div class="ct-editor-wrap">
                <textarea id="${MODULE_NAME}_drawer_prompt"
                          class="ct-textarea ct-textarea--editor text_pole"
                          placeholder="Enter your prompt template...

Use {{character}} for character data, {{field_name}} for specific fields.
The prompt will be sent to the LLM along with the selected character fields."
                          spellcheck="false">${DOMPurify.sanitize(promptText)}</textarea>
            </div>
            <div class="ct-form-group__hint ct-row ct-row--between">
                <span id="${MODULE_NAME}_drawer_prompt_tokens" class="ct-text-dim">Calculating tokens...</span>
            </div>
        </div>
    `;
}

function renderSchemaEditor(): string {
    const { preset } = drawerState;
    const DOMPurify = SillyTavern.libs.DOMPurify;

    let schemaText = '';
    if (preset && 'schema' in preset) {
        schemaText =
            typeof preset.schema === 'string'
                ? preset.schema
                : JSON.stringify(preset.schema, null, 2);
    }

    return `
        <div class="ct-form-group ct-form-group--grow">
            <div class="ct-row ct-row--between">
                <label class="ct-label" for="${MODULE_NAME}_drawer_schema">
                    JSON Schema <span class="ct-required">*</span>
                </label>
            </div>

            <!-- Schema Toolbar -->
            <div class="ct-editor-toolbar">
                <button id="${MODULE_NAME}_drawer_generate"
                        class="menu_button menu_button--sm menu_button--primary"
                        type="button"
                        title="Generate schema from description using AI">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                    AI Generate
                </button>
                <div class="ct-toolbar-divider"></div>
                <button id="${MODULE_NAME}_drawer_validate"
                        class="menu_button menu_button--sm"
                        type="button"
                        title="Validate JSON schema">
                    <i class="fa-solid fa-check-circle"></i>
                    Validate
                </button>
                <button id="${MODULE_NAME}_drawer_format"
                        class="menu_button menu_button--sm"
                        type="button"
                        title="Format JSON">
                    <i class="fa-solid fa-align-left"></i>
                    Format
                </button>
                <button id="${MODULE_NAME}_drawer_minify"
                        class="menu_button menu_button--sm"
                        type="button"
                        title="Minify JSON">
                    <i class="fa-solid fa-compress"></i>
                </button>
            </div>

            <!-- Schema Editor with syntax highlighting -->
            <div class="ct-code-editor" id="${MODULE_NAME}_drawer_schema_wrap">
                <pre class="ct-code-editor__highlight" id="${MODULE_NAME}_drawer_schema_highlight" aria-hidden="true"><code class="language-json"></code></pre>
                <textarea id="${MODULE_NAME}_drawer_schema"
                          class="ct-code-editor__textarea ct-textarea--code text_pole"
                          placeholder='{"name": "MySchema", "strict": true, "schema": {...}}'
                          spellcheck="false">${DOMPurify.sanitize(schemaText)}</textarea>
            </div>

            <!-- Validation messages -->
            <div id="${MODULE_NAME}_drawer_errors" class="ct-errors ct-hidden"></div>
            <div id="${MODULE_NAME}_drawer_warnings" class="ct-warnings ct-hidden"></div>
        </div>
    `;
}

function renderDrawerFooter(): string {
    const { mode, preset } = drawerState;
    const isBuiltin = preset?.isBuiltin || false;

    // Can't edit builtins directly
    const saveLabel =
        mode === 'create'
            ? 'Create Preset'
            : mode === 'edit'
              ? 'Save Changes'
              : 'Create Copy';

    return `
        <footer class="ct-drawer__footer">
            <div class="ct-row ct-row--between ct-flex-1">
                <div class="ct-row">
                    ${
                        preset && !isBuiltin && mode === 'edit'
                            ? `
                        <button id="${MODULE_NAME}_drawer_delete"
                                class="menu_button menu_button--danger"
                                type="button">
                            <i class="fa-solid fa-trash"></i>
                            Delete
                        </button>
                    `
                            : ''
                    }
                </div>
                <div class="ct-row ct-gap-2">
                    <button id="${MODULE_NAME}_drawer_cancel"
                            class="menu_button"
                            type="button">
                        Cancel
                    </button>
                    <button id="${MODULE_NAME}_drawer_save"
                            class="menu_button menu_button--primary"
                            type="button">
                        <i class="fa-solid fa-check"></i>
                        ${saveLabel}
                    </button>
                </div>
            </div>
        </footer>
    `;
}

// =============================================================================
// DRAWER MANAGEMENT
// =============================================================================

/**
 * Initialize drawer in the DOM (call once when popup opens).
 * Appends to the ST popup dialog element for proper stacking in the top layer.
 */
export function initDrawer(container: HTMLElement): void {
    // Check if drawer already exists
    if ($(`#${MODULE_NAME}_preset_drawer`)) {
        return;
    }

    // Find the ST popup dialog (which uses the browser's top layer)
    const popupDialog = container.closest('.popup');
    if (popupDialog) {
        // Append inside the dialog so it stays in the top layer stacking context
        popupDialog.insertAdjacentHTML('beforeend', renderDrawer());
    } else {
        // Fallback to body if no popup found
        document.body.insertAdjacentHTML('beforeend', renderDrawer());
    }
}

/**
 * Open the drawer for creating a new preset.
 */
export function openDrawerForCreate(
    type: PresetType,
    callbacks?: DrawerCallbacks,
): void {
    drawerState = {
        isOpen: true,
        type,
        mode: 'create',
        preset: null,
        activeTab: 'edit',
    };
    drawerCallbacks = callbacks || {};
    showDrawer();
}

/**
 * Open the drawer for editing an existing preset.
 */
export function openDrawerForEdit(
    type: PresetType,
    presetId: string,
    callbacks?: DrawerCallbacks,
): void {
    const preset =
        type === 'prompt'
            ? presetRegistry.getPromptPreset(presetId)
            : presetRegistry.getSchemaPreset(presetId);

    if (!preset) {
        toast.error('Preset not found');
        return;
    }

    // Builtins can only be duplicated
    if (preset.isBuiltin) {
        openDrawerForDuplicate(type, presetId, callbacks);
        return;
    }

    drawerState = {
        isOpen: true,
        type,
        mode: 'edit',
        preset,
        activeTab: 'edit',
    };
    drawerCallbacks = callbacks || {};
    showDrawer();
}

/**
 * Open the drawer for duplicating a preset.
 */
export function openDrawerForDuplicate(
    type: PresetType,
    presetId: string,
    callbacks?: DrawerCallbacks,
): void {
    const preset =
        type === 'prompt'
            ? presetRegistry.getPromptPreset(presetId)
            : presetRegistry.getSchemaPreset(presetId);

    if (!preset) {
        toast.error('Preset not found');
        return;
    }

    drawerState = {
        isOpen: true,
        type,
        mode: 'duplicate',
        preset,
        activeTab: 'edit',
    };
    drawerCallbacks = callbacks || {};
    showDrawer();
}

/**
 * Close the drawer.
 */
export function closeDrawer(): void {
    const drawer = $(`#${MODULE_NAME}_preset_drawer`);
    if (!drawer) return;

    drawer.classList.remove('ct-drawer--open');
    drawer.setAttribute('aria-hidden', 'true');

    // Cleanup after animation
    setTimeout(() => {
        cleanupFns.forEach((fn) => fn());
        cleanupFns = [];
        drawerState.isOpen = false;
        drawerCallbacks.onClose?.();
    }, 300);
}

/**
 * Check if drawer is open.
 */
export function isDrawerOpen(): boolean {
    return drawerState.isOpen;
}

/**
 * Remove drawer from DOM (call when popup closes).
 */
export function destroyDrawer(): void {
    const drawer = $(`#${MODULE_NAME}_preset_drawer`);
    if (drawer) {
        drawer.remove();
    }
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];
    drawerState.isOpen = false;
}

// =============================================================================
// INTERNAL FUNCTIONS
// =============================================================================

function showDrawer(): void {
    const drawer = $(`#${MODULE_NAME}_preset_drawer`);
    if (!drawer) {
        log.error('Drawer not initialized');
        return;
    }

    // Update drawer content
    const panel = $('.ct-drawer__panel', drawer);
    if (panel) {
        panel.innerHTML = `
            <div class="ct-drawer__content">
                ${renderDrawerHeader()}
                ${renderDrawerBody()}
                ${renderDrawerFooter()}
            </div>
        `;
    }

    // Bind events
    bindDrawerEvents(drawer);

    // Show drawer with animation
    requestAnimationFrame(() => {
        drawer.classList.add('ct-drawer--open');
        drawer.setAttribute('aria-hidden', 'false');

        // Focus first input
        const nameInput = $(`#${MODULE_NAME}_drawer_name`, drawer);
        if (nameInput) {
            (nameInput as HTMLInputElement).focus();
            (nameInput as HTMLInputElement).select();
        }

        // Initialize syntax highlighting for schema
        if (drawerState.type === 'schema') {
            updateSchemaHighlighting();
        }
    });
}

function bindDrawerEvents(drawer: HTMLElement): void {
    // Close button
    const closeBtn = $(`#${MODULE_NAME}_drawer_close`, drawer);
    if (closeBtn) {
        cleanupFns.push(on(closeBtn, 'click', closeDrawer));
    }

    // Backdrop click
    const backdrop = $('.ct-drawer__backdrop', drawer);
    if (backdrop) {
        cleanupFns.push(on(backdrop, 'click', closeDrawer));
    }

    // Cancel button
    const cancelBtn = $(`#${MODULE_NAME}_drawer_cancel`, drawer);
    if (cancelBtn) {
        cleanupFns.push(on(cancelBtn, 'click', closeDrawer));
    }

    // Save button
    const saveBtn = $(`#${MODULE_NAME}_drawer_save`, drawer);
    if (saveBtn) {
        cleanupFns.push(on(saveBtn, 'click', handleSave));
    }

    // Delete button
    const deleteBtn = $(`#${MODULE_NAME}_drawer_delete`, drawer);
    if (deleteBtn) {
        cleanupFns.push(on(deleteBtn, 'click', handleDelete));
    }

    // Stage chips
    const stageChips = $$('.ct-chip input[name="drawer_stages"]', drawer);
    for (const chip of stageChips) {
        cleanupFns.push(
            on(chip, 'change', () => {
                const label = chip.closest('.ct-chip');
                if (label) {
                    label.classList.toggle(
                        'ct-chip--active',
                        (chip as HTMLInputElement).checked,
                    );
                }
            }),
        );
    }

    // Type-specific bindings
    if (drawerState.type === 'prompt') {
        bindPromptEvents(drawer);
    } else {
        bindSchemaEvents(drawer);
    }

    // Escape key
    const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && drawerState.isOpen) {
            e.preventDefault();
            e.stopPropagation();
            closeDrawer();
        }
    };
    document.addEventListener('keydown', handleKeydown);
    cleanupFns.push(() =>
        document.removeEventListener('keydown', handleKeydown),
    );
}

function bindPromptEvents(drawer: HTMLElement): void {
    const promptTextarea = $(
        `#${MODULE_NAME}_drawer_prompt`,
        drawer,
    ) as HTMLTextAreaElement;

    if (promptTextarea) {
        // Token counting
        const updateTokens = SillyTavern.libs.lodash.debounce(async () => {
            const tokensEl = $(`#${MODULE_NAME}_drawer_prompt_tokens`);
            if (!tokensEl) return;

            // Rough estimate (ST token counting may not be available)
            const text = promptTextarea.value;
            const estimate = Math.ceil(text.length / 4);
            tokensEl.textContent = `~${estimate} tokens`;
        }, 300);

        cleanupFns.push(
            on(promptTextarea, 'input', () => {
                updateTokens();
            }),
        );
        updateTokens();
    }

    // Variables help button
    const varsBtn = $(`#${MODULE_NAME}_drawer_prompt_vars`, drawer);
    if (varsBtn) {
        cleanupFns.push(
            on(varsBtn, 'click', async () => {
                await popup.alert(
                    'Available Variables',
                    `
                    <div class="ct-stack">
                        <p>Use these placeholders in your prompt:</p>
                        <ul class="ct-list ct-text-sm">
                            <li><code>{{character}}</code> - Full character summary</li>
                            <li><code>{{name}}</code> - Character name</li>
                            <li><code>{{description}}</code> - Character description</li>
                            <li><code>{{personality}}</code> - Personality traits</li>
                            <li><code>{{scenario}}</code> - Scenario/setting</li>
                            <li><code>{{first_mes}}</code> - First message</li>
                            <li><code>{{mes_example}}</code> - Example messages</li>
                            <li><code>{{system_prompt}}</code> - System prompt</li>
                            <li><code>{{creator_notes}}</code> - Creator notes</li>
                        </ul>
                    </div>
                `,
                );
            }),
        );
    }
}

function bindSchemaEvents(drawer: HTMLElement): void {
    const schemaTextarea = $(
        `#${MODULE_NAME}_drawer_schema`,
        drawer,
    ) as HTMLTextAreaElement;

    if (schemaTextarea) {
        // Sync scroll and update highlighting
        const updateHighlight = SillyTavern.libs.lodash.debounce(() => {
            updateSchemaHighlighting();
        }, 100);

        cleanupFns.push(
            on(schemaTextarea, 'input', () => {
                updateHighlight();
            }),
        );

        cleanupFns.push(
            on(schemaTextarea, 'scroll', () => {
                syncScrollPosition(schemaTextarea);
            }),
        );
    }

    // AI Generate button
    const generateBtn = $(`#${MODULE_NAME}_drawer_generate`, drawer);
    if (generateBtn) {
        cleanupFns.push(
            on(generateBtn, 'click', async () => {
                const description = await popup.input(
                    'Generate Schema',
                    'Describe the structure you want:',
                    'e.g., rating 1-10, list of strengths and weaknesses, summary paragraph',
                );

                if (!description) return;

                // Show loading
                generateBtn.setAttribute('disabled', 'true');
                const icon = generateBtn.querySelector('i');
                const originalIcon = icon?.className;
                if (icon) icon.className = 'fa-solid fa-spinner fa-spin';

                try {
                    const result =
                        await generateSchemaFromDescription(description);
                    if (result.success && result.schema && schemaTextarea) {
                        schemaTextarea.value = result.schema;
                        updateSchemaHighlighting();
                        toast.success('Schema generated');
                        clearValidationMessages();
                    } else {
                        toast.error(result.error || 'Generation failed');
                    }
                } catch (e) {
                    toast.error(`Failed: ${(e as Error).message}`);
                } finally {
                    generateBtn.removeAttribute('disabled');
                    if (icon && originalIcon) icon.className = originalIcon;
                }
            }),
        );
    }

    // Validate button
    const validateBtn = $(`#${MODULE_NAME}_drawer_validate`, drawer);
    if (validateBtn && schemaTextarea) {
        cleanupFns.push(
            on(validateBtn, 'click', () => {
                const result = validateSchema(schemaTextarea.value);
                showValidationResult(result);
            }),
        );
    }

    // Format button
    const formatBtn = $(`#${MODULE_NAME}_drawer_format`, drawer);
    if (formatBtn && schemaTextarea) {
        cleanupFns.push(
            on(formatBtn, 'click', () => {
                try {
                    const parsed = JSON.parse(schemaTextarea.value);
                    schemaTextarea.value = formatSchema(parsed);
                    updateSchemaHighlighting();
                    toast.success('Formatted');
                } catch (e) {
                    toast.error(`Invalid JSON: ${(e as Error).message}`);
                }
            }),
        );
    }

    // Minify button
    const minifyBtn = $(`#${MODULE_NAME}_drawer_minify`, drawer);
    if (minifyBtn && schemaTextarea) {
        cleanupFns.push(
            on(minifyBtn, 'click', () => {
                try {
                    const parsed = JSON.parse(schemaTextarea.value);
                    schemaTextarea.value = JSON.stringify(parsed);
                    updateSchemaHighlighting();
                    toast.success('Minified');
                } catch (e) {
                    toast.error(`Invalid JSON: ${(e as Error).message}`);
                }
            }),
        );
    }
}

function updateSchemaHighlighting(): void {
    const textarea = $(
        `#${MODULE_NAME}_drawer_schema`,
    ) as HTMLTextAreaElement | null;
    const highlightEl = $(`#${MODULE_NAME}_drawer_schema_highlight code`);

    if (!textarea || !highlightEl) return;

    const hljs = SillyTavern.libs.hljs;
    const DOMPurify = SillyTavern.libs.DOMPurify;

    try {
        // Highlight the code
        const highlighted = hljs.highlight(textarea.value || ' ', {
            language: 'json',
        });
        highlightEl.innerHTML = DOMPurify.sanitize(highlighted.value);
    } catch {
        // If highlighting fails, just show plain text
        highlightEl.textContent = textarea.value;
    }
}

function syncScrollPosition(textarea: HTMLTextAreaElement): void {
    const highlightPre = $(`#${MODULE_NAME}_drawer_schema_highlight`);
    if (highlightPre) {
        highlightPre.scrollTop = textarea.scrollTop;
        highlightPre.scrollLeft = textarea.scrollLeft;
    }
}

function showValidationResult(result: {
    valid: boolean;
    error?: string;
    warnings?: string[];
}): void {
    const errorsDiv = $(`#${MODULE_NAME}_drawer_errors`);
    const warningsDiv = $(`#${MODULE_NAME}_drawer_warnings`);

    if (errorsDiv) {
        if (result.valid) {
            errorsDiv.classList.add('ct-hidden');
            toast.success('Schema is valid');
        } else {
            errorsDiv.innerHTML = `<div class="ct-error"><i class="fa-solid fa-times-circle"></i> ${result.error}</div>`;
            errorsDiv.classList.remove('ct-hidden');
        }
    }

    if (warningsDiv) {
        if (result.warnings?.length) {
            warningsDiv.innerHTML = result.warnings
                .map(
                    (w) =>
                        `<div class="ct-warning"><i class="fa-solid fa-exclamation-triangle"></i> ${w}</div>`,
                )
                .join('');
            warningsDiv.classList.remove('ct-hidden');
        } else {
            warningsDiv.classList.add('ct-hidden');
        }
    }
}

function clearValidationMessages(): void {
    const errorsDiv = $(`#${MODULE_NAME}_drawer_errors`);
    const warningsDiv = $(`#${MODULE_NAME}_drawer_warnings`);
    errorsDiv?.classList.add('ct-hidden');
    warningsDiv?.classList.add('ct-hidden');
}

// =============================================================================
// SAVE & DELETE HANDLERS
// =============================================================================

async function handleSave(): Promise<void> {
    const { type, mode, preset } = drawerState;

    // Gather form data
    const nameInput = $(`#${MODULE_NAME}_drawer_name`) as HTMLInputElement;
    const name = nameInput?.value.trim() || '';

    const stageCheckboxes = $$(
        'input[name="drawer_stages"]:checked',
    ) as HTMLInputElement[];
    const stages = Array.from(stageCheckboxes).map(
        (cb) => cb.value as StageName,
    );
    const finalStages = stages.length === STAGES.length ? [] : stages;

    if (type === 'prompt') {
        const promptTextarea = $(
            `#${MODULE_NAME}_drawer_prompt`,
        ) as HTMLTextAreaElement;
        const prompt = promptTextarea?.value || '';

        // Validate
        const validation = validatePromptPreset({
            name,
            prompt,
            stages: finalStages,
        });
        if (!validation.valid) {
            showFormErrors(validation.errors);
            return;
        }

        // Check unique name
        const excludeId = mode === 'edit' ? preset?.id : undefined;
        if (!presetRegistry.isNameUnique('prompt', name, excludeId)) {
            showFormErrors(['A preset with this name already exists']);
            return;
        }

        let result: PromptPreset;
        if (mode === 'edit' && preset) {
            presetRegistry.updatePromptPreset(preset.id, {
                name,
                prompt,
                stages: finalStages,
            });
            result = presetRegistry.getPromptPreset(preset.id)!;
            toast.success('Preset updated');
        } else {
            result = presetRegistry.registerPromptPreset({
                name,
                prompt,
                stages: finalStages,
            });
            toast.success('Preset created');
        }

        drawerCallbacks.onSave?.(result);
        closeDrawer();
    } else {
        const schemaTextarea = $(
            `#${MODULE_NAME}_drawer_schema`,
        ) as HTMLTextAreaElement;
        const schemaStr = schemaTextarea?.value || '';

        // Parse schema
        let schema: StructuredOutputSchema;
        try {
            schema = JSON.parse(schemaStr);
        } catch (e) {
            showFormErrors([`Invalid JSON: ${(e as Error).message}`]);
            return;
        }

        // Validate
        const validation = validateSchemaPreset({
            name,
            schema,
            stages: finalStages,
        });
        if (!validation.valid) {
            showFormErrors(validation.errors);
            return;
        }

        // Check unique name
        const excludeId = mode === 'edit' ? preset?.id : undefined;
        if (!presetRegistry.isNameUnique('schema', name, excludeId)) {
            showFormErrors(['A preset with this name already exists']);
            return;
        }

        let result: SchemaPreset;
        if (mode === 'edit' && preset) {
            presetRegistry.updateSchemaPreset(preset.id, {
                name,
                schema,
                stages: finalStages,
            });
            result = presetRegistry.getSchemaPreset(preset.id)!;
            toast.success('Schema preset updated');
        } else {
            result = presetRegistry.registerSchemaPreset({
                name,
                schema,
                stages: finalStages,
            });
            toast.success('Schema preset created');
        }

        drawerCallbacks.onSave?.(result);
        closeDrawer();
    }
}

function showFormErrors(errors: string[]): void {
    const errorsDiv = $(`#${MODULE_NAME}_drawer_errors`);
    if (errorsDiv) {
        errorsDiv.innerHTML = errors
            .map(
                (e) =>
                    `<div class="ct-error"><i class="fa-solid fa-times-circle"></i> ${e}</div>`,
            )
            .join('');
        errorsDiv.classList.remove('ct-hidden');
    }
}

async function handleDelete(): Promise<void> {
    const { type, preset } = drawerState;
    if (!preset) return;

    const confirmed = await popup.confirm(
        'Delete Preset',
        `Are you sure you want to delete "${preset.name}"?`,
    );
    if (!confirmed) return;

    if (type === 'prompt') {
        presetRegistry.deletePromptPreset(preset.id);
    } else {
        presetRegistry.deleteSchemaPreset(preset.id);
    }

    toast.success('Preset deleted');
    closeDrawer();
}
