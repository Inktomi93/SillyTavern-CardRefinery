// src/state/popup-state.ts
// =============================================================================
// POPUP STATE MANAGEMENT
// =============================================================================

import { STAGES } from '../shared';
import { getStageDefaults } from '../data';
import type {
    PopupState,
    StageName,
    StageStatus,
    StageConfig,
    StageResult,
    Character,
    Session,
    FieldSelection,
} from '../types';
import { createAutoSave } from './auto-save';
import {
    setCharacterAction,
    createNewSessionAction,
    loadSessionAction,
    deleteSessionAction,
} from './session-actions';

// =============================================================================
// STATE SINGLETON
// =============================================================================

let state: PopupState | null = null;

// =============================================================================
// AUTO-SAVE SETUP
// =============================================================================

const autoSaveImpl = createAutoSave(
    () => state,
    (value) => {
        if (state) state.hasUnsavedChanges = value;
    },
);

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Create fresh popup state.
 */
export function createInitialState(): PopupState {
    return {
        character: null,
        selectedFields: {}, // Deprecated, kept for compatibility
        stageFields: {
            base: {},
            linked: true,
            overrides: {},
        },

        activeSessionId: null,
        sessions: [],
        sessionsLoaded: false,
        hasUnsavedChanges: false,

        selectedStages: [...STAGES],
        stageStatus: {
            score: 'pending',
            rewrite: 'pending',
            analyze: 'pending',
        },
        stageResults: { score: null, rewrite: null, analyze: null },
        stageConfigs: {
            score: getStageDefaults('score'),
            rewrite: getStageDefaults('rewrite'),
            analyze: getStageDefaults('analyze'),
        },
        activeStage: 'score',
        iterationCount: 0,
        iterationHistory: [],
        userGuidance: '',

        isGenerating: false,
        abortController: null,

        searchQuery: '',
        searchResults: [],
        searchSelectedIndex: -1,
        dropdownOpen: false,

        sessionListExpanded: false,
        historyExpanded: true,
    };
}

/**
 * Initialize state.
 */
export function initState(): PopupState {
    state = createInitialState();
    return state;
}

/**
 * Get current state.
 */
export function getState(): PopupState {
    if (!state) throw new Error('State not initialized');
    return state;
}

/**
 * Get state or null (for cleanup checks).
 */
export function getStateOrNull(): PopupState | null {
    return state;
}

/**
 * Clear state (on popup close).
 */
export function clearState(): void {
    cancelAutoSave();
    state = null;
}

// =============================================================================
// AUTO-SAVE
// =============================================================================

/**
 * Trigger auto-save.
 */
export function autoSave(): void {
    const s = getStateOrNull();
    if (s) {
        s.hasUnsavedChanges = true;
        autoSaveImpl();
    }
}

/**
 * Force immediate save.
 */
export async function forceSave(): Promise<void> {
    autoSaveImpl.flush();
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
export async function deleteSession(sessionId: string): Promise<void> {
    return deleteSessionAction(getState(), sessionId);
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
    s.stageFields.linked = !s.stageFields.linked;

    // When unlinking, copy base to current stage override
    if (!s.stageFields.linked) {
        const { lodash } = SillyTavern.libs;
        s.stageFields.overrides[s.activeStage] = lodash.cloneDeep(
            s.stageFields.base,
        );
    }

    autoSave();
}

/**
 * Update field selection (respects linking).
 * @deprecated Use toggleField instead
 */
export function setFieldSelection(selection: FieldSelection): void {
    const s = getState();

    if (s.stageFields.linked) {
        s.stageFields.base = selection;
    } else {
        s.stageFields.overrides[s.activeStage] = selection;
    }

    // Keep legacy field in sync for compatibility
    s.selectedFields = selection;
    autoSave();
}

/**
 * Toggle a single field.
 */
export function toggleField(key: string, value: boolean | number[]): void {
    const s = getState();

    // Determine which selection to modify
    const selection = s.stageFields.linked
        ? s.stageFields.base
        : (s.stageFields.overrides[s.activeStage] ??= {});

    if (value === false || (Array.isArray(value) && value.length === 0)) {
        delete selection[key];
    } else {
        selection[key] = value;
    }

    // Keep legacy field in sync
    s.selectedFields = { ...selection };
    autoSave();
}

// =============================================================================
// STAGE MANAGEMENT
// =============================================================================

/**
 * Set active stage view.
 */
export function setActiveStage(stage: StageName): void {
    getState().activeStage = stage;
}

/**
 * Toggle stage selection for pipeline.
 */
export function toggleStageSelection(stage: StageName): void {
    const s = getState();
    const idx = s.selectedStages.indexOf(stage);

    if (idx === -1) {
        s.selectedStages.push(stage);
        s.selectedStages.sort((a, b) => STAGES.indexOf(a) - STAGES.indexOf(b));
    } else {
        s.selectedStages.splice(idx, 1);
    }
}

/**
 * Update stage config.
 */
export function updateStageConfig(
    stage: StageName,
    updates: Partial<StageConfig>,
): void {
    const s = getState();
    Object.assign(s.stageConfigs[stage], updates);
    autoSave();
}

/**
 * Set stage status.
 */
export function setStageStatus(stage: StageName, status: StageStatus): void {
    getState().stageStatus[stage] = status;
}

/**
 * Record stage result.
 */
export function recordStageResult(result: StageResult): void {
    const s = getState();

    s.stageResults[result.stage] = result;
    s.stageStatus[result.stage] = result.error ? 'error' : 'complete';
    s.iterationHistory.push(result);

    autoSave();
}

/**
 * Increment iteration count.
 */
export function incrementIteration(): void {
    const s = getState();
    s.iterationCount++;
    autoSave();
}

/**
 * Reset pipeline state (keep character & session).
 */
export function resetPipeline(): void {
    const s = getState();

    s.stageStatus = {
        score: 'pending',
        rewrite: 'pending',
        analyze: 'pending',
    };
    s.stageResults = { score: null, rewrite: null, analyze: null };
    s.iterationCount = 0;
    s.userGuidance = '';
    // Keep history for reference

    autoSave();
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
    const s = getState();
    s.userGuidance = guidance;
    autoSave();
}

// =============================================================================
// GENERATION STATE
// =============================================================================

/**
 * Set generation state.
 */
export function setGenerating(
    generating: boolean,
    controller?: AbortController,
): void {
    const s = getState();
    s.isGenerating = generating;
    s.abortController = generating
        ? (controller ?? new AbortController())
        : null;
}

/**
 * Abort current generation.
 */
export function abortGeneration(): void {
    const s = getStateOrNull();
    if (s?.abortController) {
        s.abortController.abort();
        s.abortController = null;
        s.isGenerating = false;
    }
}

// =============================================================================
// SEARCH STATE
// =============================================================================

/**
 * Update search state.
 */
export function setSearchState(updates: {
    query?: string;
    results?: Character[];
    selectedIndex?: number;
    dropdownOpen?: boolean;
}): void {
    const s = getState();

    if (updates.query !== undefined) s.searchQuery = updates.query;
    if (updates.results !== undefined) s.searchResults = updates.results;
    if (updates.selectedIndex !== undefined)
        s.searchSelectedIndex = updates.selectedIndex;
    if (updates.dropdownOpen !== undefined)
        s.dropdownOpen = updates.dropdownOpen;
}

// =============================================================================
// CHARACTER REFRESH
// =============================================================================

/**
 * Refresh current character data from ST.
 * Call this when CHARACTER_EDITED fires to get updated data.
 */
export function refreshCharacter(): void {
    const s = getStateOrNull();
    if (!s?.character) return;

    const ctx = SillyTavern.getContext();
    const characters = ctx.characters || [];

    // Find the character by avatar (unique identifier)
    const updated = characters.find(
        (c: Character) => c.avatar === s.character?.avatar,
    );

    if (updated) {
        s.character = updated;
    }
}

// =============================================================================
// UI STATE
// =============================================================================

/**
 * Toggle session list expanded.
 */
export function toggleSessionList(): void {
    const s = getState();
    s.sessionListExpanded = !s.sessionListExpanded;
}

/**
 * Toggle history expanded.
 */
export function toggleHistory(): void {
    const s = getState();
    s.historyExpanded = !s.historyExpanded;
}
