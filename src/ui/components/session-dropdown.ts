// src/ui/components/session-dropdown.ts
// =============================================================================
// SESSION DROPDOWN - Compact session selector with inline actions
// =============================================================================

import { MODULE_NAME, popup, toast } from '../../shared';
import {
    getState,
    createNewSession,
    loadSession,
    deleteSession,
    renameSession,
} from '../../state';
import { $, on, cx } from './base';
import { refreshAfterSessionChange } from './update-coordinator';
import type { Session } from '../../types';

// =============================================================================
// DROPDOWN STATE
// =============================================================================

let isOpen = false;
let editingSessionId: string | null = null;

function setDropdownOpen(open: boolean): void {
    isOpen = open;
    const dropdown = $(`#${MODULE_NAME}_session_dropdown`);
    if (dropdown) {
        dropdown.classList.toggle('cr-dropdown--open', open);
    }
    // Update aria-expanded on trigger
    const trigger = $(`#${MODULE_NAME}_session_trigger`);
    if (trigger) {
        trigger.setAttribute('aria-expanded', String(open));
    }
    if (!open) {
        editingSessionId = null;
    }
}

// =============================================================================
// HTML TEMPLATES
// =============================================================================

function formatSessionDate(timestamp: number): string {
    const moment = SillyTavern.libs.moment;
    const m = moment(timestamp);
    return m.calendar(null, {
        sameDay: '[Today] h:mm A',
        lastDay: '[Yesterday] h:mm A',
        lastWeek: 'ddd, h:mm A',
        sameElse: 'MMM D, h:mm A',
    });
}

function getSessionDisplayName(session: Session): string {
    if (session.name) return session.name;
    return formatSessionDate(session.updatedAt);
}

function renderSessionOption(session: Session, isActive: boolean): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const displayName = getSessionDisplayName(session);
    const isEditing = editingSessionId === session.id;

    // Get summary info
    const fieldCount = Object.keys(session.stageFields?.base ?? {}).length;
    const historyCount = session.history.length;

    return /* html */ `
        <div class="cr-session-option ${cx(isActive && 'cr-session-option--active')}"
             data-session-id="${session.id}"
             role="option"
             aria-selected="${isActive}">
            <div class="cr-session-option__content">
                ${
                    isEditing
                        ? `
                    <input type="text"
                           class="cr-session-option__name-input"
                           value="${DOMPurify.sanitize(session.name || '')}"
                           placeholder="Session name..."
                           autocomplete="off"
                           data-session-id="${session.id}" />
                `
                        : `
                    <div class="cr-session-option__name">
                        ${isActive ? '<i class="fa-solid fa-circle cr-session-option__indicator"></i>' : ''}
                        <span>${DOMPurify.sanitize(displayName)}</span>
                    </div>
                `
                }
                <div class="cr-session-option__meta">
                    <span>${fieldCount} fields</span>
                    <span>${historyCount} runs</span>
                </div>
            </div>
            <div class="cr-session-option__actions ${cx(isEditing && 'cr-session-option__actions--editing')}">
                ${
                    isEditing
                        ? `
                    <button class="cr-session-save menu_button menu_button--icon menu_button--sm menu_button--ghost"
                            type="button"
                            title="Save name"
                            data-session-id="${session.id}">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button class="cr-session-cancel menu_button menu_button--icon menu_button--sm menu_button--ghost"
                            type="button"
                            title="Cancel">
                        <i class="fa-solid fa-times"></i>
                    </button>
                `
                        : `
                    <button class="cr-session-edit menu_button menu_button--icon menu_button--sm menu_button--ghost"
                            type="button"
                            title="Rename session"
                            data-session-id="${session.id}">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button class="cr-session-delete menu_button menu_button--icon menu_button--sm menu_button--ghost"
                            type="button"
                            title="Delete session"
                            data-session-id="${session.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `
                }
            </div>
        </div>
    `;
}

function renderDropdownList(): string {
    const state = getState();
    const sessions = state.sessions;

    if (!state.character) {
        return /* html */ `
            <div class="cr-dropdown__empty">
                <i class="fa-solid fa-user-slash"></i>
                Select a character first
            </div>
        `;
    }

    if (sessions.length === 0) {
        return /* html */ `
            <div class="cr-dropdown__empty">
                <i class="fa-solid fa-folder-open"></i>
                No sessions yet
            </div>
        `;
    }

    return sessions
        .map((s) => renderSessionOption(s, s.id === state.activeSessionId))
        .join('');
}

/**
 * Render session dropdown component.
 */
export function renderSessionDropdown(): string {
    const state = getState();
    const activeSession = state.sessions.find(
        (s) => s.id === state.activeSessionId,
    );
    const hasCharacter = !!state.character;

    // Determine display text
    let displayText = 'No session';
    if (!hasCharacter) {
        displayText = 'Select character...';
    } else if (activeSession) {
        displayText = getSessionDisplayName(activeSession);
    }

    const sessionCount = state.sessions.length;

    return /* html */ `
        <div id="${MODULE_NAME}_session_dropdown" class="cr-dropdown cr-dropdown--session ${cx(isOpen && 'cr-dropdown--open')} ${cx(!hasCharacter && 'cr-dropdown--disabled')}">
            <button id="${MODULE_NAME}_session_trigger"
                    class="cr-dropdown__trigger cr-dropdown__trigger--session"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded="${isOpen}"
                    ${!hasCharacter ? 'disabled' : ''}>
                <i class="fa-solid fa-folder cr-dropdown__trigger-icon"></i>
                <span class="cr-dropdown__trigger-text ${cx(!activeSession && 'cr-dropdown__trigger-text--placeholder')}">${SillyTavern.libs.DOMPurify.sanitize(displayText)}</span>
                ${sessionCount > 0 ? `<span class="cr-dropdown__count">${sessionCount}</span>` : ''}
                <i class="fa-solid fa-chevron-down cr-dropdown__trigger-chevron"></i>
            </button>
            <div class="cr-dropdown__panel cr-dropdown__panel--session" role="listbox">
                <div id="${MODULE_NAME}_session_list" class="cr-dropdown__list cr-dropdown__list--session cr-scrollable">
                    ${renderDropdownList()}
                </div>
                <div class="cr-dropdown__footer">
                    <button id="${MODULE_NAME}_new_session_btn"
                            class="menu_button menu_button--sm menu_button--primary cr-dropdown__new-btn"
                            type="button"
                            ${!hasCharacter ? 'disabled' : ''}>
                        <i class="fa-solid fa-plus"></i>
                        New Session
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Update the session dropdown display.
 */
export function updateSessionDropdown(): void {
    const dropdown = $(`#${MODULE_NAME}_session_dropdown`);
    if (!dropdown) return;

    const state = getState();
    const activeSession = state.sessions.find(
        (s) => s.id === state.activeSessionId,
    );
    const hasCharacter = !!state.character;

    // Update disabled state
    dropdown.classList.toggle('cr-dropdown--disabled', !hasCharacter);

    // Update trigger
    const trigger = $(`#${MODULE_NAME}_session_trigger`) as HTMLButtonElement;
    if (trigger) {
        trigger.disabled = !hasCharacter;

        let displayText = 'No session';
        if (!hasCharacter) {
            displayText = 'Select character...';
        } else if (activeSession) {
            displayText = getSessionDisplayName(activeSession);
        }

        const sessionCount = state.sessions.length;
        trigger.innerHTML = /* html */ `
            <i class="fa-solid fa-folder cr-dropdown__trigger-icon"></i>
            <span class="cr-dropdown__trigger-text ${cx(!activeSession && 'cr-dropdown__trigger-text--placeholder')}">${SillyTavern.libs.DOMPurify.sanitize(displayText)}</span>
            ${sessionCount > 0 ? `<span class="cr-dropdown__count">${sessionCount}</span>` : ''}
            <i class="fa-solid fa-chevron-down cr-dropdown__trigger-chevron"></i>
        `;
    }

    // Update new session button
    const newBtn = $(`#${MODULE_NAME}_new_session_btn`) as HTMLButtonElement;
    if (newBtn) {
        newBtn.disabled = !hasCharacter;
    }

    // Update list
    const list = $(`#${MODULE_NAME}_session_list`);
    if (list) {
        list.innerHTML = renderDropdownList();
    }
}

/**
 * Bind session dropdown events.
 */
export function bindSessionDropdownEvents(container: HTMLElement): () => void {
    const cleanups: Array<() => void> = [];

    const dropdown = $(`#${MODULE_NAME}_session_dropdown`, container);
    const trigger = $(`#${MODULE_NAME}_session_trigger`, container);
    const list = $(`#${MODULE_NAME}_session_list`, container);
    const newBtn = $(`#${MODULE_NAME}_new_session_btn`, container);

    // Toggle dropdown on trigger click
    if (trigger) {
        cleanups.push(
            on(trigger, 'click', (e) => {
                e.stopPropagation();
                if ((trigger as HTMLButtonElement).disabled) return;
                setDropdownOpen(!isOpen);
            }),
        );
    }

    // Close on outside click
    const handleOutsideClick = (e: MouseEvent) => {
        if (isOpen && dropdown && !dropdown.contains(e.target as Node)) {
            setDropdownOpen(false);
            updateSessionDropdown();
        }
    };
    document.addEventListener('click', handleOutsideClick);
    cleanups.push(() =>
        document.removeEventListener('click', handleOutsideClick),
    );

    // New session button
    if (newBtn) {
        cleanups.push(
            on(newBtn, 'click', async (e) => {
                e.stopPropagation();
                const session = await createNewSession();
                if (session) {
                    toast.success('New session created');
                    setDropdownOpen(false);
                    refreshAfterSessionChange();
                }
            }),
        );
    }

    // Session list interactions (event delegation)
    if (list) {
        cleanups.push(
            on(list, 'click', async (e) => {
                const target = e.target as HTMLElement;
                const sessionOption = target.closest('.cr-session-option');
                if (!sessionOption) return;

                const sessionId =
                    (sessionOption as HTMLElement).dataset.sessionId ||
                    (target as HTMLElement).dataset.sessionId;
                if (!sessionId) return;

                // Handle edit button
                if (target.closest('.cr-session-edit')) {
                    e.stopPropagation();
                    editingSessionId = sessionId;
                    updateSessionDropdown();
                    // Focus the input
                    setTimeout(() => {
                        const input = $(
                            `.cr-session-option__name-input[data-session-id="${sessionId}"]`,
                        ) as HTMLInputElement;
                        if (input) {
                            input.focus();
                            input.select();
                        }
                    }, 0);
                    return;
                }

                // Handle save button
                if (target.closest('.cr-session-save')) {
                    e.stopPropagation();
                    const input = $(
                        `.cr-session-option__name-input[data-session-id="${sessionId}"]`,
                    ) as HTMLInputElement;
                    if (input) {
                        await renameSession(sessionId, input.value);
                        toast.success('Session renamed');
                    }
                    editingSessionId = null;
                    updateSessionDropdown();
                    return;
                }

                // Handle cancel button
                if (target.closest('.cr-session-cancel')) {
                    e.stopPropagation();
                    editingSessionId = null;
                    updateSessionDropdown();
                    return;
                }

                // Handle delete button
                if (target.closest('.cr-session-delete')) {
                    e.stopPropagation();
                    const confirmed = await popup.confirm(
                        'Delete Session',
                        'Are you sure you want to delete this session? This cannot be undone.',
                    );
                    if (confirmed) {
                        await deleteSession(sessionId);
                        toast.success('Session deleted');
                        updateSessionDropdown();
                        refreshAfterSessionChange();
                    }
                    return;
                }

                // Handle click on session to load it (if not active and not editing)
                if (
                    !sessionOption.classList.contains(
                        'cr-session-option--active',
                    ) &&
                    !editingSessionId
                ) {
                    const success = await loadSession(sessionId);
                    if (success) {
                        toast.success('Session loaded');
                        setDropdownOpen(false);
                        refreshAfterSessionChange();
                    } else {
                        toast.error('Failed to load session');
                    }
                }
            }),
        );

        // Handle Enter key in rename input
        cleanups.push(
            on(list, 'keydown', async (e) => {
                const target = e.target as HTMLElement;
                if (!target.classList.contains('cr-session-option__name-input'))
                    return;

                const sessionId = (target as HTMLInputElement).dataset
                    .sessionId;
                if (!sessionId) return;

                if (e.key === 'Enter') {
                    e.preventDefault();
                    await renameSession(
                        sessionId,
                        (target as HTMLInputElement).value,
                    );
                    toast.success('Session renamed');
                    editingSessionId = null;
                    updateSessionDropdown();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    editingSessionId = null;
                    updateSessionDropdown();
                }
            }),
        );
    }

    return () => {
        cleanups.forEach((fn) => fn());
        // Reset state
        isOpen = false;
        editingSessionId = null;
    };
}
