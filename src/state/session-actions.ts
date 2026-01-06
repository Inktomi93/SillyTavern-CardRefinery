// src/state/session-actions.ts
// =============================================================================
// SESSION-RELATED STATE ACTIONS
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

    // Set loading flag to prevent auto-save during state transition
    (state as unknown as { _isLoading?: boolean })._isLoading = true;

    try {
        state.character = char;
        state.selectedFields = {};
        state.stageFields = { base: {}, linked: true, overrides: {} };
        state.activeSessionId = null;
        state.sessions = [];
        state.sessionsLoaded = false;

        // Reset pipeline state
        state.stageStatus = {
            score: 'pending',
            rewrite: 'pending',
            analyze: 'pending',
        };
        state.stageResults = { score: null, rewrite: null, analyze: null };
        state.iterationCount = 0;
        state.iterationHistory = [];
        state.hasUnsavedChanges = false;

        if (char) {
            // Ensure character is fully loaded (not shallow)
            try {
                state.character = await ensureUnshallowed(char);
                log.debug(`Character loaded: ${state.character.name}`);
            } catch (e) {
                log.error('Failed to unshallow character', e);
                state.character = char; // Use as-is
            }

            // Auto-select all populated fields
            const populatedFields = getPopulatedFields(state.character);
            const baseSelection: FieldSelection = {};
            for (const field of populatedFields) {
                baseSelection[field.key] = true;
            }
            state.stageFields = {
                base: baseSelection,
                linked: true,
                overrides: {},
            };
            state.selectedFields = baseSelection; // Keep legacy in sync

            // Load sessions for this character (but don't auto-select)
            state.sessions = await getSessionsForCharacter(char.avatar);
            state.sessionsLoaded = true;

            // No auto-selection - sessions are lazy-created on first meaningful action
            log.debug(
                `Character ${char.name}: ${state.sessions.length} sessions, ${populatedFields.length} fields selected`,
            );
        }
    } finally {
        // Clear loading flag
        (state as unknown as { _isLoading?: boolean })._isLoading = false;
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

    state.sessions.unshift(session);
    state.activeSessionId = session.id;
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
    state.sessions.unshift(session);
    state.activeSessionId = session.id;
    state.iterationCount = 0;
    state.iterationHistory = [];
    state.stageResults = { score: null, rewrite: null, analyze: null };
    state.stageStatus = {
        score: 'pending',
        rewrite: 'pending',
        analyze: 'pending',
    };
    state.hasUnsavedChanges = false;

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

    // Set loading flag to prevent auto-save during state transition
    (state as unknown as { _isLoading?: boolean })._isLoading = true;

    try {
        // Load character if different
        if (state.character?.avatar !== session.characterId) {
            const characters = SillyTavern.getContext().characters;
            const char = characters.find(
                (c: Character) => c.avatar === session.characterId,
            );
            if (!char) return false;
            state.character = char;
        }

        // Restore state from session
        const _ = SillyTavern.libs.lodash;
        state.activeSessionId = session.id;
        state.stageFields = _.cloneDeep(session.stageFields);
        state.selectedFields = _.cloneDeep(session.stageFields.base); // Keep legacy in sync
        state.stageConfigs = _.cloneDeep(session.configs);
        state.iterationHistory = _.cloneDeep(session.history);
        state.iterationCount = session.iterationCount;
        state.userGuidance = session.userGuidance || '';
        state.hasUnsavedChanges = false;

        // Restore results - prefer saved stageResults, fall back to deriving from history
        if (session.stageResults) {
            state.stageResults = _.cloneDeep(session.stageResults);
        } else {
            // Legacy: derive from history (last result per stage)
            state.stageResults = { score: null, rewrite: null, analyze: null };
            for (const result of session.history) {
                state.stageResults[result.stage] = result;
            }
        }

        // Update status based on results
        for (const stage of STAGES) {
            state.stageStatus[stage] = state.stageResults[stage]
                ? state.stageResults[stage]!.error
                    ? 'error'
                    : 'complete'
                : 'pending';
        }

        return true;
    } finally {
        // Clear loading flag
        (state as unknown as { _isLoading?: boolean })._isLoading = false;
    }
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
    const idx = state.sessions.findIndex((sess) => sess.id === sessionId);
    if (idx !== -1) state.sessions.splice(idx, 1);

    // Clear if it was active
    if (state.activeSessionId === sessionId) {
        state.activeSessionId = null;
        state.iterationHistory = [];
        state.iterationCount = 0;
        state.stageResults = { score: null, rewrite: null, analyze: null };
        state.stageStatus = {
            score: 'pending',
            rewrite: 'pending',
            analyze: 'pending',
        };
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
    state.sessions = [];
    state.activeSessionId = null;
    state.iterationHistory = [];
    state.iterationCount = 0;
    state.stageResults = { score: null, rewrite: null, analyze: null };
    state.stageStatus = {
        score: 'pending',
        rewrite: 'pending',
        analyze: 'pending',
    };

    return result;
}
