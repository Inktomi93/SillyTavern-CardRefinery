// src/ui/components/character-selector.ts
// =============================================================================
// CHARACTER SELECTOR - Compact dropdown in header
// =============================================================================

import { MODULE_NAME, DEBOUNCE } from '../../shared';
import { getPopulatedFields } from '../../domain';
import { getState, setCharacter } from '../../state';
import { $, $$, on, truncate } from './base';
import { withRenderBoundary } from '../error-boundary';
import { refreshAfterCharacterChange } from './update-coordinator';
import type { Character } from '../../types';

// Helper to get all characters from ST context
function getCharacters(): Character[] {
    return SillyTavern.getContext().characters || [];
}

// =============================================================================
// FUSE CONFIGURATION
// =============================================================================

let fuseInstance: InstanceType<typeof SillyTavern.libs.Fuse> | null = null;

interface FuseResult {
    item: Character;
    score?: number;
}

function getFuse() {
    const chars = getCharacters();
    if (!fuseInstance || fuseInstance._docs?.length !== chars.length) {
        const Fuse = SillyTavern.libs.Fuse;
        fuseInstance = new Fuse(chars, {
            keys: [
                { name: 'name', weight: 3 },
                { name: 'description', weight: 1 },
            ],
            threshold: 0.3, // Tighter matching
            includeScore: true,
            minMatchCharLength: 2,
            ignoreLocation: true,
        });
    }
    return fuseInstance;
}

/**
 * Reset Fuse instance (call when characters change).
 */
export function resetFuse(): void {
    fuseInstance = null;
}

// =============================================================================
// DROPDOWN STATE
// =============================================================================

let isOpen = false;
let searchQuery = '';
let highlightedIndex = -1;
// Track search debounce at module level to prevent race conditions on rapid re-bind
let searchDebounce: ReturnType<typeof SillyTavern.libs.lodash.debounce> | null =
    null;

function setDropdownOpen(open: boolean): void {
    isOpen = open;
    const dropdown = $(`#${MODULE_NAME}_char_dropdown`);
    if (dropdown) {
        dropdown.classList.toggle('cr-dropdown--open', open);
    }
    // Update aria-expanded on trigger
    const trigger = $(`#${MODULE_NAME}_char_trigger`);
    if (trigger) {
        trigger.setAttribute('aria-expanded', String(open));
    }
    if (!open) {
        highlightedIndex = -1;
    }
}

// =============================================================================
// HTML TEMPLATES
// =============================================================================

function renderCharacterOption(
    char: Character,
    index: number,
    isSelected: boolean,
): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const avatarUrl = SillyTavern.getContext().getThumbnailUrl(
        'avatar',
        char.avatar,
    );
    const fields = getPopulatedFields(char);
    const fieldCount = fields.length;

    // Get a short description snippet
    const description = char.description || '';
    const descSnippet = truncate(description.replace(/\n/g, ' '), 60);

    // Get creator/version info if available
    const creator = char.data?.creator || '';
    const version = char.data?.character_version || '';
    const metaParts: string[] = [];
    if (creator) metaParts.push(creator);
    if (version) metaParts.push(`v${version}`);
    if (metaParts.length === 0) {
        metaParts.push(
            `${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'}`,
        );
    }

    return /* html */ `
        <div class="cr-char-option ${isSelected ? 'cr-char-option--selected' : ''} ${index === highlightedIndex ? 'cr-char-option--highlighted' : ''}"
             data-avatar="${DOMPurify.sanitize(char.avatar)}"
             data-index="${index}"
             role="option"
             aria-selected="${isSelected}">
            <div class="cr-char-option__avatar-wrap">
                <img class="cr-char-option__avatar"
                     src="${avatarUrl}"
                     alt=""
                     onerror="this.src='/img/ai4.png'"
                     loading="lazy"/>
                ${isSelected ? '<i class="fa-solid fa-check cr-char-option__check"></i>' : ''}
            </div>
            <div class="cr-char-option__info">
                <span class="cr-char-option__name">${DOMPurify.sanitize(char.name)}</span>
                ${descSnippet ? `<span class="cr-char-option__desc">${DOMPurify.sanitize(descSnippet)}</span>` : ''}
                <span class="cr-char-option__meta">
                    <i class="fa-solid fa-user-pen"></i>
                    ${DOMPurify.sanitize(metaParts.join(' • '))}
                </span>
            </div>
        </div>
    `;
}

function getFilteredCharacters(): Character[] {
    const query = searchQuery.trim();
    if (!query) {
        // Show recent/all characters (limit to prevent performance issues)
        return getCharacters().slice(0, 30);
    }

    const results = getFuse().search(query) as FuseResult[];
    return results.map((r) => r.item).slice(0, 20);
}

function renderDropdownList(): string {
    const state = getState();
    const characters = getFilteredCharacters();
    const selectedAvatar = state.character?.avatar;

    if (characters.length === 0) {
        return /* html */ `
            <div class="cr-dropdown__empty">
                <i class="fa-solid ${searchQuery ? 'fa-search' : 'fa-users-slash'}"></i>
                ${searchQuery ? `No matches for "${truncate(searchQuery, 20)}"` : 'No characters available'}
            </div>
        `;
    }

    return characters
        .map((c, i) => renderCharacterOption(c, i, c.avatar === selectedAvatar))
        .join('');
}

/**
 * Render character selector component.
 */
const _renderCharacterSelector = (): string => {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const state = getState();
    const selectedChar = state.character;

    const displayText = selectedChar
        ? DOMPurify.sanitize(selectedChar.name)
        : 'Select character...';

    const avatarHtml = selectedChar
        ? `<img class="cr-dropdown__trigger-avatar"
               src="${SillyTavern.getContext().getThumbnailUrl('avatar', selectedChar.avatar)}"
               alt=""
               onerror="this.src='/img/ai4.png'" />`
        : '<i class="fa-solid fa-user cr-dropdown__trigger-icon"></i>';

    return /* html */ `
        <div id="${MODULE_NAME}_char_dropdown" class="cr-dropdown ${isOpen ? 'cr-dropdown--open' : ''}">
            <button id="${MODULE_NAME}_char_trigger"
                    class="cr-dropdown__trigger"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded="${isOpen}">
                ${avatarHtml}
                <span class="cr-dropdown__trigger-text ${!selectedChar ? 'cr-dropdown__trigger-text--placeholder' : ''}">${displayText}</span>
                <i class="fa-solid fa-chevron-down cr-dropdown__trigger-chevron"></i>
            </button>
            <div class="cr-dropdown__panel" role="listbox">
                <div class="cr-dropdown__search">
                    <i class="fa-solid fa-search cr-dropdown__search-icon"></i>
                    <input type="text"
                           id="${MODULE_NAME}_char_search"
                           class="cr-dropdown__search-input"
                           placeholder="Search characters..."
                           autocomplete="off"
                           value="${DOMPurify.sanitize(searchQuery)}"/>
                    ${
                        searchQuery
                            ? /* html */ `
                        <button class="cr-dropdown__search-clear" type="button" aria-label="Clear">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    `
                            : ''
                    }
                </div>
                <div id="${MODULE_NAME}_char_list" class="cr-dropdown__list cr-scrollable">
                    ${renderDropdownList()}
                </div>
            </div>
        </div>
    `;
};
export const renderCharacterSelector = withRenderBoundary(
    _renderCharacterSelector,
    { name: 'CharacterSelector' },
);

/**
 * Update the dropdown display.
 */
export function updateCharacterSelector(): void {
    const dropdown = $(`#${MODULE_NAME}_char_dropdown`);
    if (!dropdown) return;

    // Update trigger
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const state = getState();
    const selectedChar = state.character;
    const trigger = $(`#${MODULE_NAME}_char_trigger`);

    if (trigger) {
        const displayText = selectedChar
            ? DOMPurify.sanitize(selectedChar.name)
            : 'Select character...';

        const avatarHtml = selectedChar
            ? `<img class="cr-dropdown__trigger-avatar"
                   src="${SillyTavern.getContext().getThumbnailUrl('avatar', selectedChar.avatar)}"
                   alt=""
                   onerror="this.src='/img/ai4.png'" />`
            : '<i class="fa-solid fa-user cr-dropdown__trigger-icon"></i>';

        trigger.innerHTML = /* html */ `
            ${avatarHtml}
            <span class="cr-dropdown__trigger-text ${!selectedChar ? 'cr-dropdown__trigger-text--placeholder' : ''}">${displayText}</span>
            <i class="fa-solid fa-chevron-down cr-dropdown__trigger-chevron"></i>
        `;
    }

    // Update list
    const list = $(`#${MODULE_NAME}_char_list`);
    if (list) {
        list.innerHTML = renderDropdownList();
    }
}

/**
 * Bind character selector events.
 */
export function bindCharacterSelectorEvents(
    container: HTMLElement,
): () => void {
    const cleanups: Array<() => void> = [];

    const dropdown = $(`#${MODULE_NAME}_char_dropdown`, container);
    const trigger = $(`#${MODULE_NAME}_char_trigger`, container);
    const searchInput = $(
        `#${MODULE_NAME}_char_search`,
        container,
    ) as HTMLInputElement;
    const list = $(`#${MODULE_NAME}_char_list`, container);

    // Toggle dropdown on trigger click
    if (trigger) {
        cleanups.push(
            on(trigger, 'click', (e) => {
                e.stopPropagation();
                setDropdownOpen(!isOpen);
                if (isOpen && searchInput) {
                    setTimeout(() => searchInput.focus(), 0);
                }
            }),
        );
    }

    // Close on outside click
    const handleOutsideClick = (e: MouseEvent) => {
        if (isOpen && dropdown && !dropdown.contains(e.target as Node)) {
            setDropdownOpen(false);
        }
    };
    document.addEventListener('click', handleOutsideClick);
    cleanups.push(() =>
        document.removeEventListener('click', handleOutsideClick),
    );

    // Search input
    if (searchInput) {
        // Cancel any existing search debounce before creating new one
        // This prevents race conditions if component is rapidly re-bound
        if (searchDebounce) {
            searchDebounce.cancel();
            searchDebounce = null;
        }

        searchDebounce = SillyTavern.libs.lodash.debounce(() => {
            searchQuery = searchInput.value;
            highlightedIndex = -1;
            if (list) {
                list.innerHTML = renderDropdownList();
            }
        }, DEBOUNCE.SEARCH);

        const doSearch = searchDebounce;

        cleanups.push(
            on(searchInput, 'input', () => {
                doSearch();
            }),
        );

        // Keyboard navigation
        cleanups.push(
            on(searchInput, 'keydown', (e) => {
                const items = $$('.cr-char-option', list!);
                const maxIdx = items.length - 1;

                switch (e.key) {
                    case 'ArrowDown':
                        e.preventDefault();
                        highlightedIndex = Math.min(
                            highlightedIndex + 1,
                            maxIdx,
                        );
                        updateHighlight(items);
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        highlightedIndex = Math.max(highlightedIndex - 1, 0);
                        updateHighlight(items);
                        break;
                    case 'Enter':
                        e.preventDefault();
                        if (highlightedIndex >= 0 && items[highlightedIndex]) {
                            selectCharacterFromElement(
                                items[highlightedIndex] as HTMLElement,
                            );
                        }
                        break;
                    case 'Escape':
                        e.preventDefault();
                        setDropdownOpen(false);
                        trigger?.focus();
                        break;
                }
            }),
        );

        cleanups.push(() => {
            doSearch.cancel();
            searchDebounce = null;
        });
    }

    // Clear search button
    const clearBtn = $('.cr-dropdown__search-clear', container);
    if (clearBtn && searchInput) {
        cleanups.push(
            on(clearBtn, 'click', (e) => {
                e.stopPropagation();
                searchInput.value = '';
                searchQuery = '';
                highlightedIndex = -1;
                if (list) {
                    list.innerHTML = renderDropdownList();
                }
                searchInput.focus();
            }),
        );
    }

    // Option click
    if (list) {
        cleanups.push(
            on(list, 'click', (e) => {
                const option = (e.target as HTMLElement).closest(
                    '.cr-char-option',
                );
                if (option) {
                    selectCharacterFromElement(option as HTMLElement);
                }
            }),
        );
    }

    return () => {
        cleanups.forEach((fn) => fn());
        // Reset state
        isOpen = false;
        searchQuery = '';
        highlightedIndex = -1;
    };
}

// =============================================================================
// HELPERS
// =============================================================================

function updateHighlight(items: Element[]): void {
    items.forEach((item, idx) => {
        item.classList.toggle(
            'cr-char-option--highlighted',
            idx === highlightedIndex,
        );
        if (idx === highlightedIndex) {
            item.scrollIntoView({ block: 'nearest' });
        }
    });
}

async function selectCharacterFromElement(el: HTMLElement): Promise<void> {
    const avatar = el.dataset.avatar;
    if (!avatar) return;

    const chars = getCharacters();
    const char = chars.find((c) => c.avatar === avatar);
    if (!char) return;

    await setCharacter(char);
    searchQuery = '';
    setDropdownOpen(false);
    refreshAfterCharacterChange();
}
