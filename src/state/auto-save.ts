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

    // The actual save logic - extracted so it can be called directly
    const saveImpl = async (): Promise<void> => {
        const s = getState();
        if (!s?.activeSessionId || !s.character) return;

        const session = await getSession(s.activeSessionId);
        if (!session) return;

        // Update session from state
        session.stageFields = _.cloneDeep(s.stageFields);
        session.configs = _.cloneDeep(s.stageConfigs);
        session.stageResults = _.cloneDeep(s.stageResults);
        session.history = _.cloneDeep(s.iterationHistory);
        session.iterationCount = s.iterationCount;
        session.userGuidance = s.userGuidance || undefined;

        await storageUpdateSession(session);
        setUnsavedChanges(false);
    };

    // Debounced version for automatic saves
    const debouncedSave = _.debounce(() => {
        saveImpl(); // Fire and forget for debounced calls
    }, 1000);

    // Return an object with both the debounced trigger and direct save
    return {
        trigger: debouncedSave,
        save: saveImpl,
        cancel: () => debouncedSave.cancel(),
        flush: async () => {
            debouncedSave.cancel(); // Cancel pending debounce
            await saveImpl(); // Execute save directly and await
        },
    };
}
