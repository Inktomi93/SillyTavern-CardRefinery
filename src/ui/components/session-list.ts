// src/ui/components/session-list.ts
// =============================================================================
// SESSION LIST COMPONENT - Manage saved sessions for the current character
// =============================================================================

import { MODULE_NAME, popup, toast } from '../../shared';
import {
    getState,
    toggleSessionList,
    createNewSession,
    loadSession,
    deleteSession,
} from '../../state';
import { $, on, cx, morphUpdate } from './base';
import { refreshAfterSessionChange } from './update-coordinator';
import type { Session } from '../../types';

// =============================================================================
// HTML TEMPLATES
// =============================================================================

function renderSessionItem(session: Session, isActive: boolean): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const moment = SillyTavern.libs.moment;

    // Use moment for smarter date formatting
    const m = moment(session.updatedAt);
    const timeStr = m.calendar(null, {
        sameDay: '[Today] h:mm A',
        lastDay: '[Yesterday] h:mm A',
        lastWeek: 'ddd, h:mm A',
        sameElse: 'MMM D, h:mm A',
    });

    // Get summary info - count base fields (works with both old and new format)
    const fieldCount = Object.keys(session.stageFields?.base ?? {}).length;
    const historyCount = session.history.length;

    return `
        <div class="ct-session-item ${cx(isActive && 'ct-session-item--active')}"
             data-session-id="${session.id}"
             role="option"
             aria-selected="${isActive}">
            <div class="ct-session-item__content">
                <div class="ct-session-item__header">
                    <span class="ct-session-item__date">${DOMPurify.sanitize(timeStr)}</span>
                    ${isActive ? '<span class="ct-badge ct-badge--accent ct-badge--small">Active</span>' : ''}
                </div>
                <div class="ct-session-item__meta">
                    <span><i class="fa-solid fa-list-check"></i> ${fieldCount} fields</span>
                    <span><i class="fa-solid fa-clock-rotate-left"></i> ${historyCount} runs</span>
                    <span><i class="fa-solid fa-rotate"></i> ${session.iterationCount} iterations</span>
                </div>
            </div>
            <div class="ct-session-item__actions">
                ${
                    !isActive
                        ? `
                    <button class="ct-session-load menu_button menu_button--icon menu_button--sm menu_button--ghost"
                            type="button"
                            title="Load session">
                        <i class="fa-solid fa-folder-open"></i>
                    </button>
                `
                        : ''
                }
                <button class="ct-session-delete menu_button menu_button--icon menu_button--sm menu_button--ghost"
                        type="button"
                        title="Delete session">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

/**
 * Render session list component.
 */
export function renderSessionList(): string {
    const state = getState();
    const sessions = state.sessions;
    const isExpanded = state.sessionListExpanded;

    // Always render container shell, show loading/empty state based on character/sessionsLoaded
    const showSessions = state.character && state.sessionsLoaded;

    return `
        <div id="${MODULE_NAME}_sessions_container" class="ct-sessions ${cx(!isExpanded && 'ct-sessions--collapsed')} ${cx(!showSessions && 'ct-sessions--hidden')}">
            <button class="ct-sessions__toggle"
                    type="button"
                    aria-expanded="${isExpanded}"
                    title="Saved workspaces - load to continue previous work">
                <span>${sessions.length === 0 ? 'No saved sessions' : `Saved Sessions (${sessions.length})`}</span>
                <i class="fa-solid fa-chevron-down ct-sessions__toggle-icon"></i>
            </button>
            <div class="ct-sessions__content">
                <div class="ct-sessions__actions">
                    <button id="${MODULE_NAME}_new_session"
                            class="menu_button menu_button--sm menu_button--primary"
                            type="button">
                        <i class="fa-solid fa-plus"></i>
                        New Session
                    </button>
                </div>
                <div id="${MODULE_NAME}_session_list" class="ct-sessions__list ct-scrollable">
                    ${
                        sessions.length > 0
                            ? sessions
                                  .map((s) =>
                                      renderSessionItem(
                                          s,
                                          s.id === state.activeSessionId,
                                      ),
                                  )
                                  .join('')
                            : `
                            <div class="ct-empty ct-p-3">
                                <div class="ct-empty__text">No saved sessions</div>
                                <div class="ct-text-xs ct-text-dim ct-mt-2">
                                    Create a new session to save your work
                                </div>
                            </div>
                        `
                    }
                </div>
            </div>
        </div>
    `;
}

/**
 * Update session list display.
 */
export function updateSessionList(): void {
    const container = $(`#${MODULE_NAME}_sessions_container`);
    if (!container) return;

    const state = getState();
    const sessions = state.sessions;
    const showSessions = state.character && state.sessionsLoaded;

    // Toggle visibility based on state
    container.classList.toggle('ct-sessions--hidden', !showSessions);

    if (!showSessions) return;

    // Update toggle text
    const toggle = container.querySelector('.ct-sessions__toggle span');
    if (toggle) {
        toggle.textContent =
            sessions.length === 0
                ? 'No saved sessions'
                : `Saved Sessions (${sessions.length})`;
    }

    // Update list using morphdom for efficient updates
    const list = $(`#${MODULE_NAME}_session_list`);
    if (list) {
        const listHtml =
            sessions.length > 0
                ? sessions
                      .map((s) =>
                          renderSessionItem(s, s.id === state.activeSessionId),
                      )
                      .join('')
                : `
                <div class="ct-empty ct-p-3">
                    <div class="ct-empty__text">No saved sessions</div>
                    <div class="ct-text-xs ct-text-dim ct-mt-2">
                        Create a new session to save your work
                    </div>
                </div>
            `;
        morphUpdate(list, listHtml);
    }
}

/**
 * Refresh all UI components after session change.
 * Uses centralized update coordinator for proper batching.
 */
function refreshAllUI(): void {
    refreshAfterSessionChange();
}

/**
 * Bind session list events.
 */
export function bindSessionListEvents(container: HTMLElement): () => void {
    const cleanups: Array<() => void> = [];

    // Toggle session list
    const toggle = $('.ct-sessions__toggle', container);
    const sessionsSection = $('.ct-sessions', container);
    if (toggle && sessionsSection) {
        cleanups.push(
            on(toggle, 'click', () => {
                toggleSessionList();
                sessionsSection.classList.toggle('ct-sessions--collapsed');
                toggle.setAttribute(
                    'aria-expanded',
                    String(getState().sessionListExpanded),
                );
            }),
        );
    }

    // New session button
    const newSessionBtn = $(`#${MODULE_NAME}_new_session`, container);
    if (newSessionBtn) {
        cleanups.push(
            on(newSessionBtn, 'click', async () => {
                const session = await createNewSession();
                if (session) {
                    toast.success('New session created');
                    refreshAllUI();
                }
            }),
        );
    }

    // Session list interactions (event delegation)
    const sessionList = $(`#${MODULE_NAME}_session_list`, container);
    if (sessionList) {
        cleanups.push(
            on(sessionList, 'click', async (e) => {
                const target = e.target as HTMLElement;
                const sessionItem = target.closest('.ct-session-item');
                if (!sessionItem) return;

                const sessionId = (sessionItem as HTMLElement).dataset
                    .sessionId;
                if (!sessionId) return;

                // Handle delete button
                if (target.closest('.ct-session-delete')) {
                    e.stopPropagation();
                    const confirmed = await popup.confirm(
                        'Delete Session',
                        'Are you sure you want to delete this session? This cannot be undone.',
                    );
                    if (confirmed) {
                        await deleteSession(sessionId);
                        toast.success('Session deleted');
                        refreshAllUI();
                    }
                    return;
                }

                // Handle load button or click on non-active session
                if (
                    target.closest('.ct-session-load') ||
                    !sessionItem.classList.contains('ct-session-item--active')
                ) {
                    const success = await loadSession(sessionId);
                    if (success) {
                        toast.success('Session loaded');
                        refreshAllUI();
                    } else {
                        toast.error('Failed to load session');
                    }
                }
            }),
        );
    }

    return () => {
        cleanups.forEach((fn) => fn());
    };
}
