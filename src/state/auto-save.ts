// src/state/auto-save.ts
// =============================================================================
// AUTO-SAVE LOGIC
// =============================================================================

// Direct ST libs access - debounce and cloneDeep
import {
    getSession,
    updateSession as storageUpdateSession,
    createSession as storageCreateSession,
} from '../data';
import { buildOriginalData } from '../domain';
import { log } from '../shared';
import type { PopupState } from '../types';
import { setState } from './store';

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

    // Mutex to prevent concurrent saves
    let inFlightSave: Promise<void> | null = null;

    // The actual save logic - extracted so it can be called directly
    const saveImpl = async (): Promise<void> => {
        // Wait for any in-flight save to complete first
        if (inFlightSave) {
            await inFlightSave;
        }

        const s = getState();
        if (!s?.character) return;

        // Check for loading flag to avoid saving partial state
        if ((s as unknown as { _isLoading?: boolean })._isLoading) return;

        let session;

        // Lazy session creation: if no active session, create one
        if (!s.activeSessionId) {
            const originalData = buildOriginalData(
                s.character,
                s.stageFields.base,
            );

            session = await storageCreateSession({
                characterId: s.character.avatar,
                characterName: s.character.name,
                stageFields: s.stageFields,
                originalData,
                configs: s.stageConfigs,
            });

            // Update state through store to notify subscribers (UI session list)
            setState('session', {
                sessions: [session, ...s.sessions],
                activeSessionId: session.id,
            });
            log.debug(`Lazy-created session on auto-save: ${session.id}`);
        } else {
            session = await getSession(s.activeSessionId);
            if (!session) return;
        }

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

    // Wrapped save that tracks in-flight operations
    const trackedSave = async (): Promise<void> => {
        const savePromise = saveImpl();
        inFlightSave = savePromise;
        try {
            await savePromise;
        } finally {
            // Only clear if this is still the tracked promise
            if (inFlightSave === savePromise) {
                inFlightSave = null;
            }
        }
    };

    // Debounced version for automatic saves
    const debouncedSave = _.debounce(() => {
        trackedSave(); // Fire and forget for debounced calls
    }, 1000);

    // Return an object with both the debounced trigger and direct save
    return {
        trigger: debouncedSave,
        save: trackedSave,
        cancel: () => debouncedSave.cancel(),
        flush: async () => {
            debouncedSave.cancel(); // Cancel pending debounce
            // Wait for any in-flight save, then do final save
            if (inFlightSave) {
                await inFlightSave;
            }
            await trackedSave(); // Execute save directly and await
        },
    };
}
