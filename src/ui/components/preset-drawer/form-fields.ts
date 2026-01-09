// src/ui/components/preset-drawer/form-fields.ts
// =============================================================================
// FORM FIELD RENDERERS
// =============================================================================

import { MODULE_NAME, STAGE_LABELS, STAGES } from '../../../shared';
import { drawerState } from './state';
import { withRenderBoundary } from '../../error-boundary';
import type { PromptPreset } from '../../../types';

// =============================================================================
// FIELD RENDERERS
// =============================================================================

const _renderNameField = (): string => {
    const { preset, mode } = drawerState;
    const DOMPurify = SillyTavern.libs.DOMPurify;

    let defaultName = '';
    if (preset) {
        defaultName =
            mode === 'duplicate' ? `${preset.name} (Copy)` : preset.name;
    }

    return /* html */ `
        <div class="cr-form-group">
            <label class="cr-label" for="${MODULE_NAME}_drawer_name">
                Name <span class="cr-required">*</span>
            </label>
            <input type="text"
                   id="${MODULE_NAME}_drawer_name"
                   class="cr-input text_pole"
                   value="${DOMPurify.sanitize(defaultName)}"
                   placeholder="Enter preset name..."
                   maxlength="100"
                   autocomplete="off"/>
        </div>
    `;
};
export const renderNameField = withRenderBoundary(_renderNameField, {
    name: 'PresetNameField',
});

const _renderStagesField = (): string => {
    const { preset } = drawerState;
    const stages = preset?.stages || [];

    return /* html */ `
        <div class="cr-form-group">
            <label class="cr-label">
                Applicable Stages
                <span class="cr-hint cr-text-dim">(empty = all stages)</span>
            </label>
            <div class="cr-stage-chips">
                ${STAGES.map(
                    (s) => /* html */ `
                    <label class="cr-chip ${stages.length === 0 || stages.includes(s) ? 'cr-chip--active' : ''}">
                        <input type="checkbox"
                               name="drawer_stages"
                               value="${s}"
                               ${stages.length === 0 || stages.includes(s) ? 'checked' : ''}/>
                        <span>${STAGE_LABELS[s]}</span>
                    </label>
                `,
                ).join('')}
            </div>
        </div>
    `;
};
export const renderStagesField = withRenderBoundary(_renderStagesField, {
    name: 'PresetStagesField',
});

const _renderPromptEditor = (): string => {
    const { preset } = drawerState;
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const promptText = (preset as PromptPreset)?.prompt || '';

    return /* html */ `
        <div class="cr-form-group cr-form-group--grow">
            <label class="cr-label" for="${MODULE_NAME}_drawer_prompt">
                Prompt Template <span class="cr-required">*</span>
            </label>
            <div class="cr-editor-wrap">
                <textarea id="${MODULE_NAME}_drawer_prompt"
                          class="cr-textarea cr-textarea--editor text_pole"
                          placeholder="Enter instructions for the LLM.

Your prompt will be combined with the selected character fields and any previous stage results."
                          spellcheck="false">${DOMPurify.sanitize(promptText)}</textarea>
            </div>
            <div class="cr-form-group__hint cr-row cr-row--between">
                <span id="${MODULE_NAME}_drawer_prompt_tokens" class="cr-text-dim">Calculating tokens...</span>
            </div>
        </div>
    `;
};
export const renderPromptEditor = withRenderBoundary(_renderPromptEditor, {
    name: 'PresetPromptEditor',
});

const _renderSchemaEditor = (): string => {
    const { preset } = drawerState;
    const DOMPurify = SillyTavern.libs.DOMPurify;

    let schemaText = '';
    if (preset && 'schema' in preset) {
        schemaText =
            typeof preset.schema === 'string'
                ? preset.schema
                : JSON.stringify(preset.schema, null, 2);
    }

    return /* html */ `
        <div class="cr-form-group cr-form-group--grow">
            <div class="cr-row cr-row--between">
                <label class="cr-label" for="${MODULE_NAME}_drawer_schema">
                    JSON Schema <span class="cr-required">*</span>
                </label>
            </div>

            <!-- Schema Toolbar -->
            <div class="cr-editor-toolbar">
                <button id="${MODULE_NAME}_drawer_generate"
                        class="menu_button menu_button--sm menu_button--primary"
                        type="button"
                        title="Generate schema from description using AI">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                    AI Generate
                </button>
                <div class="cr-toolbar-divider"></div>
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
            <div class="cr-code-editor" id="${MODULE_NAME}_drawer_schema_wrap">
                <pre class="cr-code-editor__highlight" id="${MODULE_NAME}_drawer_schema_highlight" aria-hidden="true"><code class="language-json"></code></pre>
                <textarea id="${MODULE_NAME}_drawer_schema"
                          class="cr-code-editor__textarea cr-textarea--code text_pole"
                          placeholder='{"name": "MySchema", "strict": true, "schema": {...}}'
                          spellcheck="false">${DOMPurify.sanitize(schemaText)}</textarea>
            </div>

            <!-- Validation messages -->
            <div id="${MODULE_NAME}_drawer_errors" class="cr-errors cr-hidden"></div>
            <div id="${MODULE_NAME}_drawer_warnings" class="cr-warnings cr-hidden"></div>
        </div>
    `;
};
export const renderSchemaEditor = withRenderBoundary(_renderSchemaEditor, {
    name: 'PresetSchemaEditor',
});
