// src/ui/components/stage-config/field-selector.ts
// =============================================================================
// FIELD SELECTOR RENDERING
// =============================================================================

import { MODULE_NAME } from '../../../shared';
import { getState, getCurrentFieldSelection } from '../../../state';
import { getPopulatedFields } from '../../../domain';
import { $, $$, formatTokenCount } from '../base';
import { withRenderBoundary } from '../../error-boundary';
import { loadFieldTokens, updateFieldTotal } from './token-display';
import type { PopulatedField } from '../../../types';

// =============================================================================
// FIELD SELECTOR
// =============================================================================

const _renderFieldSelector = (): string => {
    const state = getState();

    if (!state.character) {
        return /* html */ `
            <div class="cr-empty cr-empty--compact cr-empty--inline">
                <i class="fa-solid fa-user-slash cr-empty__icon"></i>
                <span class="cr-empty__text">Select a character to see fields</span>
            </div>
        `;
    }

    const fields = getPopulatedFields(state.character);

    if (fields.length === 0) {
        return /* html */ `
            <div class="cr-empty cr-empty--compact cr-empty--inline">
                <i class="fa-solid fa-file-circle-question cr-empty__icon"></i>
                <span class="cr-empty__text">No populated fields found</span>
            </div>
        `;
    }

    // Trigger async token loading after render
    requestAnimationFrame(() => loadFieldTokens(fields));

    return /* html */ `
        <div class="cr-field-list cr-scrollable">
            ${fields.map((field) => renderFieldItem(field)).join('')}
        </div>
        <div class="cr-field-total">
            <span class="cr-field-total__label">Selected:</span>
            <span id="${MODULE_NAME}_field_total" class="cr-field-total__value">calculating...</span>
        </div>
        <div id="${MODULE_NAME}_token_warning" class="cr-token-warning cr-hidden">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span class="cr-token-warning__text"></span>
        </div>
    `;
};
export const renderFieldSelector = withRenderBoundary(_renderFieldSelector, {
    name: 'FieldSelector',
});

// =============================================================================
// FIELD ITEM
// =============================================================================

const _renderFieldItem = (field: PopulatedField): string => {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const selection = getCurrentFieldSelection();
    const isSelected = field.key in selection && selection[field.key] !== false;

    // Handle alternate_greetings - expandable list of individual greetings
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

    // Handle character_book - expandable list of lorebook entries
    if (field.key === 'character_book' && field.rawValue) {
        const book = field.rawValue as {
            name?: string;
            entries?: Array<{
                id?: number;
                name?: string;
                comment?: string;
                keys?: string[];
                enabled?: boolean;
            }>;
        };
        const entries = book.entries || [];
        if (entries.length === 0) {
            return ''; // No entries to show
        }

        const selectedIndices = Array.isArray(selection[field.key])
            ? (selection[field.key] as number[])
            : [];
        const allSelected = selectedIndices.length === entries.length;
        const bookName = book.name || 'Character Lorebook';

        return /* html */ `
            <div class="cr-field-group cr-field-group--expandable" data-field="${field.key}">
                <div class="cr-field-item cr-field-item--parent">
                    <label class="cr-field-label">
                        <input type="checkbox"
                               class="cr-field-checkbox cr-field-checkbox--parent"
                               data-field="${field.key}"
                               ${allSelected ? 'checked' : ''}
                               ${selectedIndices.length > 0 && !allSelected ? 'indeterminate' : ''}/>
                        <span class="cr-field-name">${DOMPurify.sanitize(bookName)}</span>
                    </label>
                    <span class="cr-field-count">${entries.length} entries</span>
                    <button class="cr-field-expand" type="button" aria-label="Expand">
                        <i class="fa-solid fa-chevron-down"></i>
                    </button>
                </div>
                <div class="cr-field-children">
                    ${entries
                        .map((entry, i) => {
                            const title =
                                entry.name ||
                                entry.comment ||
                                entry.keys?.slice(0, 2).join(', ') ||
                                `Entry ${i + 1}`;
                            const keysPreview =
                                entry.keys?.slice(0, 3).join(', ') || '';
                            const status = entry.enabled !== false ? '✓' : '✗';
                            const statusClass =
                                entry.enabled !== false
                                    ? 'cr-entry-enabled'
                                    : 'cr-entry-disabled';

                            return /* html */ `
                        <div class="cr-field-item cr-field-item--child">
                            <label class="cr-field-label">
                                <input type="checkbox"
                                       class="cr-field-checkbox cr-field-checkbox--child"
                                       data-field="${field.key}"
                                       data-index="${i}"
                                       ${selectedIndices.includes(i) ? 'checked' : ''}/>
                                <span class="cr-entry-status ${statusClass}">${status}</span>
                                <span class="cr-field-name" title="${DOMPurify.sanitize(keysPreview)}">${DOMPurify.sanitize(title)}</span>
                            </label>
                            <button class="cr-field-preview-btn" type="button" data-field="${field.key}" data-index="${i}" title="Preview entry">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                        </div>
                    `;
                        })
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
};
export const renderFieldItem = withRenderBoundary(_renderFieldItem, {
    name: 'FieldItem',
});

// =============================================================================
// CHECKBOX STATE UPDATES
// =============================================================================

/**
 * Update field checkboxes state.
 */
export function updateFieldCheckboxes(): void {
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

    // Update token total
    updateFieldTotal();
}
