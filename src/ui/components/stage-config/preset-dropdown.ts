// src/ui/components/stage-config/preset-dropdown.ts
// =============================================================================
// PRESET DROPDOWN RENDERING
// =============================================================================

import { MODULE_NAME } from '../../../shared';
import {
    getPromptPresetsForStage,
    getSchemaPresetsForStage,
} from '../../../data';
import { $ } from '../base';
import { withRenderBoundary } from '../../error-boundary';
import type { StageName } from '../../../types';

// =============================================================================
// PRESET DROPDOWN
// =============================================================================

const _renderPresetDropdown = (
    type: 'prompt' | 'schema',
    stage: StageName,
    selectedId: string | null,
): string => {
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
};
export const renderPresetDropdown = withRenderBoundary(_renderPresetDropdown, {
    name: 'PresetDropdown',
});

// =============================================================================
// DROPDOWN REFRESH
// =============================================================================

/**
 * Refresh a preset dropdown with current options.
 */
export function refreshPresetDropdown(
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
