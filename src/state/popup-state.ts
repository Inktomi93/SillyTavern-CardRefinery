// src/state/popup-state.ts
// =============================================================================
// POPUP STATE MANAGEMENT
// =============================================================================
//
// This module provides the public API for popup state management.
// It delegates to the centralized store for actual state storage.
//
// =============================================================================

import { setStageDefaults } from '../data';
import type {
    PopupState,
    StageName,
    StageConfig,
    StageResult,
    Character,
    Session,
    FieldSelection,
} from '../types';
import {
    initStore,
    resetStore,
    getState as storeGetState,
    getStateOrNull as storeGetStateOrNull,
    setState,
    batch,
} from './store';
import { createAutoSave } from './auto-save';
import {
    setCharacterAction,
    createNewSessionAction,
    loadSessionAction,
    deleteSessionAction,
    deleteAllSessionsAction,
    ensureActiveSessionAction,
} from './session-actions';

// =============================================================================
// AUTO-SAVE SETUP
// =============================================================================

const autoSaveImpl = createAutoSave(
    () => storeGetStateOrNull(),
    (value) => {
        const s = storeGetStateOrNull();
        if (s) {
            setState('session', { hasUnsavedChanges: value });
        }
    },
);

// =============================================================================
// RE-EXPORT: createInitialState for tests
// =============================================================================

export { createInitialState } from './store';

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize state.
 */
export function initState(): PopupState {
    initStore();
    return storeGetState() as PopupState;
}

/**
 * Get current state.
 */
export function getState(): PopupState {
    return storeGetState() as PopupState;
}

/**
 * Get state or null (for cleanup checks).
 */
export function getStateOrNull(): PopupState | null {
    return storeGetStateOrNull() as PopupState | null;
}

/**
 * Clear state (on popup close).
 */
export function clearState(): void {
    cancelAutoSave();
    resetStore();
}

// =============================================================================
// AUTO-SAVE
// =============================================================================

/**
 * Trigger auto-save (debounced).
 */
export function autoSave(): void {
    const s = storeGetStateOrNull();
    if (s) {
        setState('session', { hasUnsavedChanges: true });
        autoSaveImpl.trigger();
    }
}

/**
 * Force immediate save (awaitable).
 * Cancels any pending debounced save and executes immediately.
 */
export async function forceSave(): Promise<void> {
    await autoSaveImpl.flush();
}

/**
 * Cancel pending save.
 */
export function cancelAutoSave(): void {
    autoSaveImpl.cancel();
}

// =============================================================================
// CHARACTER & SESSION (delegated to session-actions)
// =============================================================================

/**
 * Set active character and load sessions.
 */
export async function setCharacter(char: Character | null): Promise<void> {
    await setCharacterAction(getState(), char, forceSave);
}

/**
 * Create new session for current character.
 */
export async function createNewSession(): Promise<Session | null> {
    return createNewSessionAction(getState(), forceSave);
}

/**
 * Load an existing session.
 */
export async function loadSession(sessionId: string): Promise<boolean> {
    return loadSessionAction(getState(), sessionId, forceSave);
}

/**
 * Delete a session.
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
    return deleteSessionAction(getState(), sessionId);
}

/**
 * Delete all sessions for the current character.
 */
export async function deleteAllSessions(): Promise<{
    success: boolean;
    count: number;
}> {
    return deleteAllSessionsAction(getState());
}

/**
 * Ensure a session exists, creating one lazily if needed.
 * Call this before any action that requires session persistence
 * (e.g., starting generation, changing configs, changing fields).
 */
export async function ensureActiveSession(): Promise<boolean> {
    const session = await ensureActiveSessionAction(getState(), forceSave);
    return session !== null;
}

/**
 * Rename a session.
 */
export async function renameSession(
    sessionId: string,
    newName: string,
): Promise<void> {
    const state = getState();
    const sessionIndex = state.sessions.findIndex((s) => s.id === sessionId);
    if (sessionIndex === -1) return;

    // Create updated session (immutable update)
    const updatedSession = {
        ...state.sessions[sessionIndex],
        name: newName.trim() || undefined,
        updatedAt: Date.now(),
    };

    // Update state through store to notify subscribers (UI session list)
    const newSessions = [...state.sessions];
    newSessions[sessionIndex] = updatedSession;
    setState('session', { sessions: newSessions });

    // Persist to storage
    const { updateSession: storageUpdateSession } = await import('../data');
    await storageUpdateSession(updatedSession);
}

// =============================================================================
// FIELD SELECTION
// =============================================================================

/**
 * Get field selection for a specific stage.
 * If stages are linked, returns the base selection.
 * Otherwise returns the stage override or falls back to base.
 */
export function getFieldSelectionForStage(stage?: StageName): FieldSelection {
    const s = getState();
    const targetStage = stage ?? s.activeStage;

    if (s.stageFields.linked) {
        return s.stageFields.base;
    }

    return s.stageFields.overrides[targetStage] ?? s.stageFields.base;
}

/**
 * Get current stage's field selection (convenience).
 */
export function getCurrentFieldSelection(): FieldSelection {
    return getFieldSelectionForStage();
}

/**
 * Check if stages are linked.
 */
export function areStagesLinked(): boolean {
    return getState().stageFields.linked;
}

/**
 * Toggle stage linking.
 */
export function toggleStageFieldLinking(): void {
    const s = getState();
    const { lodash } = SillyTavern.libs;

    const newLinked = !s.stageFields.linked;
    const newOverrides = { ...s.stageFields.overrides };

    // When unlinking, copy base to current stage override
    if (!newLinked) {
        newOverrides[s.activeStage] = lodash.cloneDeep(s.stageFields.base);
    }

    setState('fields', {
        stageFields: {
            ...s.stageFields,
            linked: newLinked,
            overrides: newOverrides,
        },
    });

    autoSave();
}

/**
 * Toggle a single field.
 */
export function toggleField(key: string, value: boolean | number[]): void {
    const s = getState();
    const { lodash } = SillyTavern.libs;

    // Deep clone the stageFields to avoid mutations
    const newStageFields = lodash.cloneDeep(s.stageFields);

    // Determine which selection to modify
    const selection = newStageFields.linked
        ? newStageFields.base
        : (newStageFields.overrides[s.activeStage] ??= {});

    if (value === false || (Array.isArray(value) && value.length === 0)) {
        delete selection[key];
    } else {
        // Validate alternate_greetings indices against actual character data
        if (
            key === 'alternate_greetings' &&
            Array.isArray(value) &&
            s.character
        ) {
            const greetings = s.character.data?.alternate_greetings || [];
            const validIndices = value.filter(
                (idx) => idx >= 0 && idx < greetings.length,
            );
            if (validIndices.length === 0) {
                delete selection[key];
            } else {
                selection[key] = validIndices;
            }
        } else {
            selection[key] = value;
        }
    }

    // Update state with store
    setState('fields', {
        stageFields: newStageFields,
        selectedFields: { ...selection }, // Keep legacy field in sync
    });

    autoSave();
}

// =============================================================================
// STAGE MANAGEMENT
// =============================================================================

/**
 * Set active stage view.
 */
export function setActiveStage(stage: StageName): void {
    setState('pipeline', { activeStage: stage });
}

/**
 * Update stage config.
 */
export function updateStageConfig(
    stage: StageName,
    updates: Partial<StageConfig>,
): void {
    const s = getState();
    const newConfigs = {
        ...s.stageConfigs,
        [stage]: { ...s.stageConfigs[stage], ...updates },
    };

    setState('config', { stageConfigs: newConfigs });
    autoSave();

    // Also persist to settings as default template for new sessions
    setStageDefaults(stage, newConfigs[stage]);
}

// =============================================================================
// USER GUIDANCE
// =============================================================================

/**
 * Get current user guidance.
 */
export function getUserGuidance(): string {
    return getState().userGuidance;
}

/**
 * Set user guidance text.
 */
export function setUserGuidance(guidance: string): void {
    setState('guidance', { userGuidance: guidance });
    autoSave();
}

// =============================================================================
// GENERATION STATE
// =============================================================================

/**
 * Abort current generation.
 */
export function abortGeneration(): void {
    const s = storeGetStateOrNull();
    if (s?.abortController) {
        s.abortController.abort();
        setState('pipeline', {
            abortController: null,
            isGenerating: false,
        });
    }
}

// =============================================================================
// CHARACTER REFRESH
// =============================================================================

/**
 * Refresh current character data from ST.
 * Call this when CHARACTER_EDITED fires to get updated data.
 */
export function refreshCharacter(): void {
    const s = storeGetStateOrNull();
    if (!s?.character) return;

    const ctx = SillyTavern.getContext();
    const characters = ctx.characters || [];

    // Find the character by avatar (unique identifier)
    const updated = characters.find(
        (c: Character) => c.avatar === s.character?.avatar,
    );

    if (updated) {
        setState('character', { character: updated });
    }
}

// =============================================================================
// UI STATE
// =============================================================================

/**
 * Toggle history expanded.
 */
export function toggleHistory(): void {
    const s = getState();
    setState('ui', { historyExpanded: !s.historyExpanded });
}

// =============================================================================
// HISTORY NAVIGATION
// =============================================================================

/**
 * View a specific history item (null to return to current results).
 */
export function viewHistoryItem(index: number | null): void {
    const s = getState();
    if (index !== null && (index < 0 || index >= s.iterationHistory.length)) {
        return; // Invalid index
    }
    setState('ui', { viewingHistoryIndex: index });
}

/**
 * Navigate to previous history item.
 */
export function viewPreviousHistory(): void {
    const s = getState();
    if (s.iterationHistory.length === 0) return;

    if (s.viewingHistoryIndex === null) {
        // Currently viewing current - go to most recent history
        setState('ui', { viewingHistoryIndex: s.iterationHistory.length - 1 });
    } else if (s.viewingHistoryIndex > 0) {
        setState('ui', { viewingHistoryIndex: s.viewingHistoryIndex - 1 });
    }
}

/**
 * Navigate to next history item (or back to current).
 */
export function viewNextHistory(): void {
    const s = getState();
    if (s.viewingHistoryIndex === null) return; // Already at current

    if (s.viewingHistoryIndex < s.iterationHistory.length - 1) {
        setState('ui', { viewingHistoryIndex: s.viewingHistoryIndex + 1 });
    } else {
        // At end of history - return to current
        setState('ui', { viewingHistoryIndex: null });
    }
}

/**
 * Restore a history item as the current result for its stage.
 * Optionally specify an index, otherwise uses the currently viewed item.
 */
export function restoreHistoryItem(index?: number): void {
    const s = getState();
    const targetIndex = index ?? s.viewingHistoryIndex;

    if (
        targetIndex === null ||
        targetIndex < 0 ||
        targetIndex >= s.iterationHistory.length
    ) {
        return;
    }

    const result = s.iterationHistory[targetIndex];

    batch(() => {
        setState('results', {
            stageResults: {
                ...s.stageResults,
                [result.stage]: result,
            },
        });
        setState('pipeline', {
            stageStatus: {
                ...s.stageStatus,
                [result.stage]: result.error ? 'error' : 'complete',
            },
        });
        setState('ui', { viewingHistoryIndex: null });
    });

    autoSave();
}

/**
 * Get the currently viewed history item (or null if viewing current).
 */
export function getViewedHistoryItem(): StageResult | null {
    const s = getState();
    if (s.viewingHistoryIndex === null) return null;
    return s.iterationHistory[s.viewingHistoryIndex] ?? null;
}
