// src/ui/components/stage-config/stage-config.ts
// =============================================================================
// STAGE CONFIGURATION COMPONENT - RENDER & UPDATE
// =============================================================================

import { MODULE_NAME, STAGE_LABELS, STAGE_ICONS } from '../../../shared';
import { getState, areStagesLinked } from '../../../state';
import { getPromptPreset, getSchemaPreset } from '../../../data';
import { $, cx } from '../base';
import { withRenderBoundary } from '../../error-boundary';
import { renderFieldSelector, updateFieldCheckboxes } from './field-selector';
import { renderPresetDropdown, refreshPresetDropdown } from './preset-dropdown';
import { updatePromptTokenCount } from './token-display';

// =============================================================================
// RENDER
// =============================================================================

/**
 * Render stage configuration panel.
 */
const _renderStageConfig = (): string => {
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
                        <div class="cr-row cr-gap-1">
                            <button id="${MODULE_NAME}_save_schema"
                                    class="menu_button menu_button--icon menu_button--sm menu_button--ghost"
                                    type="button"
                                    title="Save as schema preset"
                                    aria-label="Save as schema preset">
                                <i class="fa-solid fa-floppy-disk"></i>
                            </button>
                            ${renderPresetDropdown('schema', stage, config.schemaPresetId)}
                        </div>
                    </div>
                    <textarea id="${MODULE_NAME}_schema"
                              class="cr-textarea--code"
                              placeholder='{"name": "MySchema", "strict": true, "value": {...}}'
                              rows="8">${DOMPurify.sanitize(schemaText)}</textarea>
                    <div class="cr-button-group">
                        <button id="${MODULE_NAME}_generate_schema"
                                class="menu_button menu_button--sm"
                                type="button"
                                title="Generate schema from description using AI">
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                            Generate
                        </button>
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
};
export const renderStageConfig = withRenderBoundary(_renderStageConfig, {
    name: 'StageConfig',
});

// =============================================================================
// UPDATE
// =============================================================================

// Track last rendered state to detect when full re-render is needed
let lastRenderedCharacterId: string | null = null;
let lastRenderedStage: string | null = null;

/**
 * Update stage config display.
 */
export function updateStageConfig(): void {
    const container = $('.cr-stage-config');
    if (!container) return;

    const state = getState();
    const stage = state.activeStage;
    const config = state.stageConfigs[stage];
    const characterId = state.character?.avatar ?? null;

    // Update header
    const headerTitle = container.querySelector('.cr-section__title');
    if (headerTitle) {
        headerTitle.innerHTML = /* html */ `
            <i class="fa-solid ${STAGE_ICONS[stage]}"></i>
            ${STAGE_LABELS[stage]} Configuration
        `;
    }

    // Only re-render field selector when character or stage changes
    const fieldsContainer = $(`#${MODULE_NAME}_fields_container`);
    if (fieldsContainer) {
        if (
            characterId !== lastRenderedCharacterId ||
            stage !== lastRenderedStage
        ) {
            // Full re-render needed - character or stage changed
            fieldsContainer.innerHTML = renderFieldSelector();
            lastRenderedCharacterId = characterId;
            lastRenderedStage = stage;
        } else {
            // Just sync checkbox state, don't re-render
            updateFieldCheckboxes();
        }
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
        updatePromptTokenCount(promptTextarea.value);
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
