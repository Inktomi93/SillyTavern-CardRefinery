// src/ui/components/preset-drawer/form-view.ts
// =============================================================================
// FORM VIEW RENDERING & EVENTS
// =============================================================================

import { MODULE_NAME, popup, toast } from '../../../shared';
import {
    validateSchema,
    formatSchema,
    generateSchemaFromDescription,
} from '../../../domain/schema';
import { $, $$, on } from '../base';
import { drawerState, addCleanup } from './state';
import {
    renderNameField,
    renderStagesField,
    renderPromptEditor,
    renderSchemaEditor,
} from './form-fields';

// =============================================================================
// FORM VIEW TEMPLATES
// =============================================================================

export function renderDrawer(): string {
    return /* html */ `
        <div id="${MODULE_NAME}_preset_drawer" class="cr-drawer" aria-hidden="true">
            <div class="cr-drawer__backdrop"></div>
            <aside class="cr-drawer__panel" role="dialog" aria-label="Preset Editor">
                <div class="cr-drawer__content">
                    ${renderDrawerHeader()}
                    ${renderDrawerBody()}
                    ${renderDrawerFooter()}
                </div>
            </aside>
        </div>
    `;
}

export function renderDrawerHeader(): string {
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

    return /* html */ `
        <header class="cr-drawer__header">
            <div class="cr-drawer__title">
                <i class="fa-solid ${icon} cr-text-accent"></i>
                <h3>${title}</h3>
                ${preset?.isBuiltin ? '<span class="cr-badge cr-badge--info cr-badge--small">builtin</span>' : ''}
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

export function renderDrawerBody(): string {
    const { type, mode, preset } = drawerState;
    const isBuiltinDuplicate = mode === 'duplicate' && preset?.isBuiltin;

    return /* html */ `
        <div class="cr-drawer__body cr-scrollable">
            ${
                isBuiltinDuplicate
                    ? /* html */ `
                <div class="cr-alert cr-alert--info cr-mb-3">
                    <i class="fa-solid fa-circle-info cr-alert__icon"></i>
                    <div class="cr-alert__content">
                        <div class="cr-alert__message">
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

export function renderDrawerFooter(): string {
    const { mode, preset } = drawerState;
    const isBuiltin = preset?.isBuiltin || false;

    // Can't edit builtins directly
    const saveLabel =
        mode === 'create'
            ? 'Create Preset'
            : mode === 'edit'
              ? 'Save Changes'
              : 'Create Copy';

    return /* html */ `
        <footer class="cr-drawer__footer">
            <div class="cr-row cr-row--between cr-flex-1">
                <div class="cr-row">
                    ${
                        preset && !isBuiltin && mode === 'edit'
                            ? /* html */ `
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
                <div class="cr-row cr-gap-2">
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
// FORM VIEW EVENTS
// =============================================================================

export function bindDrawerEvents(
    drawer: HTMLElement,
    closeDrawer: () => void,
    handleSave: () => Promise<void>,
    handleDelete: () => Promise<void>,
): void {
    // Close button
    const closeBtn = $(`#${MODULE_NAME}_drawer_close`, drawer);
    if (closeBtn) {
        addCleanup(on(closeBtn, 'click', closeDrawer));
    }

    // Backdrop click
    const backdrop = $('.cr-drawer__backdrop', drawer);
    if (backdrop) {
        addCleanup(on(backdrop, 'click', closeDrawer));
    }

    // Cancel button
    const cancelBtn = $(`#${MODULE_NAME}_drawer_cancel`, drawer);
    if (cancelBtn) {
        addCleanup(on(cancelBtn, 'click', closeDrawer));
    }

    // Save button
    const saveBtn = $(`#${MODULE_NAME}_drawer_save`, drawer);
    if (saveBtn) {
        addCleanup(on(saveBtn, 'click', handleSave));
    }

    // Delete button
    const deleteBtn = $(`#${MODULE_NAME}_drawer_delete`, drawer);
    if (deleteBtn) {
        addCleanup(on(deleteBtn, 'click', handleDelete));
    }

    // Stage chips
    const stageChips = $$('.cr-chip input[name="drawer_stages"]', drawer);
    for (const chip of stageChips) {
        addCleanup(
            on(chip, 'change', () => {
                const label = chip.closest('.cr-chip');
                if (label) {
                    label.classList.toggle(
                        'cr-chip--active',
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
    addCleanup(() => document.removeEventListener('keydown', handleKeydown));
}

// =============================================================================
// PROMPT-SPECIFIC EVENTS
// =============================================================================

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

        addCleanup(
            on(promptTextarea, 'input', () => {
                updateTokens();
            }),
        );
        updateTokens();
    }

    // Variables help button
    const varsBtn = $(`#${MODULE_NAME}_drawer_prompt_vars`, drawer);
    if (varsBtn) {
        addCleanup(
            on(varsBtn, 'click', async () => {
                await popup.alert(
                    'Available Variables',
                    /* html */ `
                    <div class="cr-stack">
                        <p>Use these placeholders in your prompt:</p>
                        <ul class="cr-list cr-text-sm">
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

// =============================================================================
// SCHEMA-SPECIFIC EVENTS
// =============================================================================

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

        addCleanup(
            on(schemaTextarea, 'input', () => {
                updateHighlight();
            }),
        );

        addCleanup(
            on(schemaTextarea, 'scroll', () => {
                syncScrollPosition(schemaTextarea);
            }),
        );
    }

    // AI Generate button
    const generateBtn = $(`#${MODULE_NAME}_drawer_generate`, drawer);
    if (generateBtn) {
        addCleanup(
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
        addCleanup(
            on(validateBtn, 'click', () => {
                const result = validateSchema(schemaTextarea.value);
                showValidationResult(result);
            }),
        );
    }

    // Format button
    const formatBtn = $(`#${MODULE_NAME}_drawer_format`, drawer);
    if (formatBtn && schemaTextarea) {
        addCleanup(
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
        addCleanup(
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

// =============================================================================
// SCHEMA HELPERS
// =============================================================================

export function updateSchemaHighlighting(): void {
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

export function showValidationResult(result: {
    valid: boolean;
    error?: string;
    warnings?: string[];
}): void {
    const errorsDiv = $(`#${MODULE_NAME}_drawer_errors`);
    const warningsDiv = $(`#${MODULE_NAME}_drawer_warnings`);

    if (errorsDiv) {
        if (result.valid) {
            errorsDiv.classList.add('cr-hidden');
            toast.success('Schema is valid');
        } else {
            errorsDiv.innerHTML = /* html */ `<div class="cr-error"><i class="fa-solid fa-times-circle"></i> ${result.error}</div>`;
            errorsDiv.classList.remove('cr-hidden');
        }
    }

    if (warningsDiv) {
        if (result.warnings?.length) {
            warningsDiv.innerHTML = result.warnings
                .map(
                    (w) =>
                        /* html */ `<div class="cr-warning"><i class="fa-solid fa-exclamation-triangle"></i> ${w}</div>`,
                )
                .join('');
            warningsDiv.classList.remove('cr-hidden');
        } else {
            warningsDiv.classList.add('cr-hidden');
        }
    }
}

export function clearValidationMessages(): void {
    const errorsDiv = $(`#${MODULE_NAME}_drawer_errors`);
    const warningsDiv = $(`#${MODULE_NAME}_drawer_warnings`);
    errorsDiv?.classList.add('cr-hidden');
    warningsDiv?.classList.add('cr-hidden');
}

export function showFormErrors(errors: string[]): void {
    const errorsDiv = $(`#${MODULE_NAME}_drawer_errors`);
    if (errorsDiv) {
        errorsDiv.innerHTML = errors
            .map(
                (e) =>
                    /* html */ `<div class="cr-error"><i class="fa-solid fa-times-circle"></i> ${e}</div>`,
            )
            .join('');
        errorsDiv.classList.remove('cr-hidden');
    }
}
