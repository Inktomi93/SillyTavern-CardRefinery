// src/state/session-actions.ts
// =============================================================================
// SESSION-RELATED STATE ACTIONS
// =============================================================================
//
// These actions manage session lifecycle using the centralized store.
// All state mutations go through setState() to ensure proper notifications.
//
// =============================================================================

import { STAGES, log } from '../shared';
import {
    getSessionsForCharacter,
    getSession,
    createSession as storageCreateSession,
    deleteSession as storageDeleteSession,
    deleteAllSessionsForCharacter as storageDeleteAllSessions,
} from '../data';
import {
    buildOriginalData,
    ensureUnshallowed,
    getPopulatedFields,
} from '../domain';
import type { PopupState, Character, Session, FieldSelection } from '../types';
import { setState, batch } from './store';

// =============================================================================
// SESSION ACTIONS
// =============================================================================

/**
 * Set active character and load sessions.
 * Sessions are loaded but NOT auto-selected. Use ensureActiveSessionAction
 * to lazily create/select a session when the user takes an action.
 */
export async function setCharacterAction(
    state: PopupState,
    char: Character | null,
    forceSave: () => Promise<void>,
): Promise<void> {
    // Save current session first
    await forceSave();

    // Reset all state for new character
    batch(() => {
        setState('character', { character: char });
        setState('fields', {
            selectedFields: {},
            stageFields: { base: {}, linked: true, overrides: {} },
        });
        setState('session', {
            activeSessionId: null,
            sessions: [],
            sessionsLoaded: false,
            hasUnsavedChanges: false,
        });
        setState('pipeline', {
            stageStatus: {
                score: 'pending',
                rewrite: 'pending',
                analyze: 'pending',
            },
        });
        setState('results', {
            stageResults: { score: null, rewrite: null, analyze: null },
            iterationCount: 0,
            iterationHistory: [],
        });
    });

    if (char) {
        // Ensure character is fully loaded (not shallow)
        let loadedChar = char;
        try {
            loadedChar = await ensureUnshallowed(char);
            log.debug(`Character loaded: ${loadedChar.name}`);
        } catch (e) {
            log.error('Failed to unshallow character', e);
            // Use as-is
        }

        // Auto-select all populated fields
        const populatedFields = getPopulatedFields(loadedChar);
        const baseSelection: FieldSelection = {};
        for (const field of populatedFields) {
            baseSelection[field.key] = true;
        }

        // Load sessions for this character (but don't auto-select)
        const sessions = await getSessionsForCharacter(loadedChar.avatar);

        // Update state with loaded data
        batch(() => {
            setState('character', { character: loadedChar });
            setState('fields', {
                stageFields: {
                    base: baseSelection,
                    linked: true,
                    overrides: {},
                },
                selectedFields: baseSelection, // Keep legacy in sync
            });
            setState('session', {
                sessions,
                sessionsLoaded: true,
            });
        });

        log.debug(
            `Character ${loadedChar.name}: ${sessions.length} sessions, ${populatedFields.length} fields selected`,
        );
    }
}

/**
 * Ensure an active session exists, creating one lazily if needed.
 * Call this before any action that requires session persistence.
 */
export async function ensureActiveSessionAction(
    state: PopupState,
    forceSave: () => Promise<void>,
): Promise<Session | null> {
    // Already have an active session
    if (state.activeSessionId) {
        const existing = state.sessions.find(
            (s) => s.id === state.activeSessionId,
        );
        if (existing) return existing;
    }

    // No character - can't create session
    if (!state.character) return null;

    // Create new session lazily
    const originalData = buildOriginalData(
        state.character,
        state.stageFields.base,
    );

    const session = await storageCreateSession({
        characterId: state.character.avatar,
        characterName: state.character.name,
        stageFields: state.stageFields,
        originalData,
        configs: state.stageConfigs,
    });

    setState('session', {
        sessions: [session, ...state.sessions],
        activeSessionId: session.id,
    });

    log.debug(`Lazy-created new session: ${session.id}`);
    return session;
}

/**
 * Create new session for current character.
 *
 * Converts domain object (Character) to primitives before passing to data layer.
 */
export async function createNewSessionAction(
    state: PopupState,
    forceSave: () => Promise<void>,
): Promise<Session | null> {
    if (!state.character) return null;

    // Save current first
    await forceSave();

    // Use base selection for original data (captures what was selected at creation)
    const originalData = buildOriginalData(
        state.character,
        state.stageFields.base,
    );

    // Pass primitives to data layer, not the full domain object
    const session = await storageCreateSession({
        characterId: state.character.avatar,
        characterName: state.character.name,
        stageFields: state.stageFields,
        originalData,
        configs: state.stageConfigs,
    });

    // Update state
    batch(() => {
        setState('session', {
            sessions: [session, ...state.sessions],
            activeSessionId: session.id,
            hasUnsavedChanges: false,
        });
        setState('results', {
            iterationCount: 0,
            iterationHistory: [],
            stageResults: { score: null, rewrite: null, analyze: null },
        });
        setState('pipeline', {
            stageStatus: {
                score: 'pending',
                rewrite: 'pending',
                analyze: 'pending',
            },
        });
    });

    return session;
}

/**
 * Load an existing session.
 */
export async function loadSessionAction(
    state: PopupState,
    sessionId: string,
    forceSave: () => Promise<void>,
): Promise<boolean> {
    // Save current first
    await forceSave();

    const session = await getSession(sessionId);
    if (!session) return false;

    // Load character if different
    let character = state.character;
    if (state.character?.avatar !== session.characterId) {
        const characters = SillyTavern.getContext().characters;
        const char = characters.find(
            (c: Character) => c.avatar === session.characterId,
        );
        if (!char) return false;
        character = char;
    }

    // Restore state from session
    const _ = SillyTavern.libs.lodash;

    // Restore results - prefer saved stageResults, fall back to deriving from history
    let stageResults = { score: null, rewrite: null, analyze: null } as Record<
        string,
        unknown
    >;
    if (session.stageResults) {
        stageResults = _.cloneDeep(session.stageResults);
    } else {
        // Legacy: derive from history (last result per stage)
        for (const result of session.history) {
            stageResults[result.stage] = result;
        }
    }

    // Calculate status based on results
    const stageStatus: Record<string, string> = {};
    for (const stage of STAGES) {
        const result = stageResults[stage] as { error?: string } | null;
        stageStatus[stage] = result
            ? result.error
                ? 'error'
                : 'complete'
            : 'pending';
    }

    batch(() => {
        setState('character', { character });
        setState('session', {
            activeSessionId: session.id,
            hasUnsavedChanges: false,
        });
        setState('fields', {
            stageFields: _.cloneDeep(session.stageFields),
            selectedFields: _.cloneDeep(session.stageFields.base),
        });
        setState('config', {
            stageConfigs: _.cloneDeep(session.configs),
        });
        setState('results', {
            iterationHistory: _.cloneDeep(session.history),
            iterationCount: session.iterationCount,
            stageResults: stageResults as PopupState['stageResults'],
        });
        setState('pipeline', {
            stageStatus: stageStatus as PopupState['stageStatus'],
        });
        setState('guidance', {
            userGuidance: session.userGuidance || '',
        });
    });

    return true;
}

/**
 * Delete a session.
 */
export async function deleteSessionAction(
    state: PopupState,
    sessionId: string,
): Promise<boolean> {
    const success = await storageDeleteSession(sessionId);

    if (!success) {
        log.error('Failed to delete session:', sessionId);
        return false;
    }

    // Remove from state
    const updatedSessions = state.sessions.filter(
        (sess) => sess.id !== sessionId,
    );

    // Clear if it was active
    if (state.activeSessionId === sessionId) {
        batch(() => {
            setState('session', {
                sessions: updatedSessions,
                activeSessionId: null,
            });
            setState('results', {
                iterationHistory: [],
                iterationCount: 0,
                stageResults: { score: null, rewrite: null, analyze: null },
            });
            setState('pipeline', {
                stageStatus: {
                    score: 'pending',
                    rewrite: 'pending',
                    analyze: 'pending',
                },
            });
        });
    } else {
        setState('session', { sessions: updatedSessions });
    }

    return true;
}

/**
 * Delete all sessions for the current character.
 */
export async function deleteAllSessionsAction(
    state: PopupState,
): Promise<{ success: boolean; count: number }> {
    if (!state.character) {
        return { success: false, count: 0 };
    }

    const result = await storageDeleteAllSessions(state.character.avatar);

    if (!result.success) {
        log.error('Failed to delete all sessions');
        return result;
    }

    // Clear state
    batch(() => {
        setState('session', {
            sessions: [],
            activeSessionId: null,
        });
        setState('results', {
            iterationHistory: [],
            iterationCount: 0,
            stageResults: { score: null, rewrite: null, analyze: null },
        });
        setState('pipeline', {
            stageStatus: {
                score: 'pending',
                rewrite: 'pending',
                analyze: 'pending',
            },
        });
    });

    return result;
}
