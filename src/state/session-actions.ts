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
} from '../data';
import { buildOriginalData, ensureUnshallowed } from '../domain';
import type { PopupState, Character, Session } from '../types';

// =============================================================================
// SESSION ACTIONS
// =============================================================================

/**
 * Set active character and load sessions.
 */
export async function setCharacterAction(
    state: PopupState,
    char: Character | null,
    forceSave: () => Promise<void>,
): Promise<void> {
    // Save current session first
    await forceSave();

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

        // Load sessions for this character
        state.sessions = await getSessionsForCharacter(char.avatar);
        state.sessionsLoaded = true;
    }
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

    // Restore latest results from history
    state.stageResults = { score: null, rewrite: null, analyze: null };
    for (const result of session.history) {
        state.stageResults[result.stage] = result;
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
}

/**
 * Delete a session.
 */
export async function deleteSessionAction(
    state: PopupState,
    sessionId: string,
): Promise<void> {
    await storageDeleteSession(sessionId);

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
}
