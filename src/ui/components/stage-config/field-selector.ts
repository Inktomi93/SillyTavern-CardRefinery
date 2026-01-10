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

    // Trigger async setup after render
    requestAnimationFrame(() => {
        loadFieldTokens(fields);
        // Set indeterminate state (can't be done via HTML attribute)
        updateFieldCheckboxes();
    });

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
                               ${allSelected ? 'checked' : ''}/>
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
                               ${allSelected ? 'checked' : ''}/>
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

    // Standard field - simple checkbox row
    return /* html */ `
        <div class="cr-field-item" data-field="${field.key}">
            <label class="cr-field-label">
                <input type="checkbox"
                       class="cr-field-checkbox"
                       data-field="${field.key}"
                       ${isSelected ? 'checked' : ''}/>
                <span class="cr-field-name">${DOMPurify.sanitize(field.label)}</span>
            </label>
            <span class="cr-field-tokens" data-field="${field.key}">${formatTokenCount(field.tokens)}</span>
            <button class="cr-field-preview-btn" type="button" data-field="${field.key}" title="Preview content">
                <i class="fa-solid fa-eye"></i>
            </button>
        </div>
    `;
};
export const renderFieldItem = withRenderBoundary(_renderFieldItem, {
    name: 'FieldItem',
});

// =============================================================================
// CHECKBOX STATE UPDATES
// =============================================================================

// Track which field groups are expanded (persists across re-renders)
const expandedGroups = new Set<string>();

/**
 * Toggle expanded state for a field group.
 * Persists across re-renders.
 */
export function toggleFieldGroupExpanded(fieldKey: string): boolean {
    if (expandedGroups.has(fieldKey)) {
        expandedGroups.delete(fieldKey);
        return false;
    } else {
        expandedGroups.add(fieldKey);
        return true;
    }
}

/**
 * Update field checkboxes state from current selection.
 * Uses state as source of truth, not DOM, to handle re-renders correctly.
 */
export function updateFieldCheckboxes(): void {
    const fieldsContainer = $(`#${MODULE_NAME}_fields_container`);
    if (!fieldsContainer) return;

    // Preserve scroll positions before any DOM changes
    const scrollable = $('.cr-field-list', fieldsContainer);
    const scrollTop = scrollable?.scrollTop ?? 0;

    // Also preserve children scroll positions (keyed by field)
    const childScrollPositions = new Map<string, number>();
    for (const children of $$('.cr-field-children', fieldsContainer)) {
        const group = children.closest('.cr-field-group') as HTMLElement;
        const fieldKey = group?.dataset.field;
        if (fieldKey && children.scrollTop > 0) {
            childScrollPositions.set(fieldKey, children.scrollTop);
        }
    }

    const selection = getCurrentFieldSelection();

    // Update expandable groups (alternate_greetings, character_book)
    const groups = $$('.cr-field-group', fieldsContainer);
    for (const group of groups) {
        const fieldKey = (group as HTMLElement).dataset.field;
        if (!fieldKey) continue;

        // Restore expanded state from persistent tracking
        if (expandedGroups.has(fieldKey)) {
            group.classList.add('cr-field-group--expanded');
        }

        const parentCheckbox = $(
            '.cr-field-checkbox--parent',
            group,
        ) as HTMLInputElement;
        const childCheckboxes = $$(
            '.cr-field-checkbox--child',
            group,
        ) as HTMLInputElement[];

        if (!parentCheckbox || childCheckboxes.length === 0) continue;

        // Get selection from state, not DOM
        const fieldSelection = selection[fieldKey];
        const selectedIndices = Array.isArray(fieldSelection)
            ? (fieldSelection as number[])
            : [];
        const totalCount = childCheckboxes.length;
        const checkedCount = selectedIndices.filter(
            (i) => i < totalCount,
        ).length;

        // Update child checkboxes from state
        childCheckboxes.forEach((cb, i) => {
            cb.checked = selectedIndices.includes(i);
        });

        // Update parent checkbox
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

    // Update regular field checkboxes
    const regularCheckboxes = $$(
        '.cr-field-item:not(.cr-field-item--parent):not(.cr-field-item--child) .cr-field-checkbox',
        fieldsContainer,
    ) as HTMLInputElement[];
    for (const cb of regularCheckboxes) {
        const fieldKey = cb.dataset.field;
        if (fieldKey) {
            cb.checked = fieldKey in selection && selection[fieldKey] !== false;
        }
    }

    // Update token total
    updateFieldTotal();

    // Restore scroll positions
    if (scrollable && scrollTop > 0) {
        scrollable.scrollTop = scrollTop;
    }
    for (const [fieldKey, pos] of childScrollPositions) {
        const group = $(
            `.cr-field-group[data-field="${fieldKey}"]`,
            fieldsContainer,
        );
        const children = group ? $('.cr-field-children', group) : null;
        if (children) {
            children.scrollTop = pos;
        }
    }
}
