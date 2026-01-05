// src/state/auto-save.ts
// =============================================================================
// AUTO-SAVE LOGIC
// =============================================================================

// Direct ST libs access - debounce and cloneDeep
import { getSession, updateSession as storageUpdateSession } from '../data';
import type { PopupState } from '../types';

// =============================================================================
// AUTO-SAVE IMPLEMENTATION
// =============================================================================

/**
 * Create auto-save debounced function.
 * Extracted to allow external state access via closure.
 */
export function createAutoSave(
    getState: () => PopupState | null,
    setUnsavedChanges: (value: boolean) => void,
) {
    const _ = SillyTavern.libs.lodash;

    const autoSaveImpl = _.debounce(async () => {
        const s = getState();
        if (!s?.activeSessionId || !s.character) return;

        const session = await getSession(s.activeSessionId);
        if (!session) return;

        // Update session from state
        session.stageFields = _.cloneDeep(s.stageFields);
        session.configs = _.cloneDeep(s.stageConfigs);
        session.history = _.cloneDeep(s.iterationHistory);
        session.iterationCount = s.iterationCount;
        session.userGuidance = s.userGuidance || undefined;

        await storageUpdateSession(session);
        setUnsavedChanges(false);
    }, 1000);

    return autoSaveImpl;
}
