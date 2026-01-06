// src/data/storage/sessions.ts
// =============================================================================
// SESSION STORAGE (LocalForage)
// =============================================================================
//
// The data layer works with primitive types and DTOs, not domain objects.
// This keeps persistence concerns separate from business logic.
//
// =============================================================================

import {
    STORAGE_KEYS,
    STORAGE_VERSION,
    MAX_SESSIONS_PER_CHARACTER,
    loadLargeData,
    storeLargeData,
    log,
} from '../../shared';
import type {
    Session,
    SessionId,
    SessionIndex,
    CharacterId,
    StorageMeta,
    StageFieldSelection,
    StageConfig,
    StageName,
} from '../../types';
import { createDefaultSession } from '../settings';
import {
    getSessionsCache,
    setSessionsCache,
    getIndexCache,
    setIndexCache,
    getMetaCache,
    setMetaCache,
} from './cache';

// =============================================================================
// TYPES - Data Transfer Objects for session creation
// =============================================================================

/**
 * DTO for creating a session. Uses primitive values instead of domain objects.
 */
export interface CreateSessionParams {
    /** Character avatar (unique identifier) */
    characterId: CharacterId;
    /** Character display name */
    characterName: string;
    /** Per-stage field selections */
    stageFields: StageFieldSelection;
    /** Original character data snapshot */
    originalData: Record<string, string>;
    /** Stage configurations */
    configs: Record<StageName, StageConfig>;
}

// =============================================================================
// INTERNAL LOADERS
// =============================================================================

async function loadMeta(): Promise<StorageMeta> {
    const cached = getMetaCache();
    if (cached) return cached;

    const data = await loadLargeData<StorageMeta>(STORAGE_KEYS.STORAGE_META);

    if (!data) {
        const meta: StorageMeta = {
            version: STORAGE_VERSION,
            lastMigration: Date.now(),
        };
        setMetaCache(meta);
        await storeLargeData(STORAGE_KEYS.STORAGE_META, meta);
        return meta;
    }

    // Migrate if needed
    if (data.version !== STORAGE_VERSION) {
        await migrateStorage(data);
    }

    setMetaCache(data);
    return data;
}

async function loadSessions(): Promise<Map<SessionId, Session>> {
    const cached = getSessionsCache();
    if (cached) return cached;

    await loadMeta(); // Ensure migrations run first

    const data = await loadLargeData<Record<SessionId, Session>>(
        STORAGE_KEYS.SESSIONS,
    );
    const cache = new Map(Object.entries(data ?? {}));
    setSessionsCache(cache);

    return cache;
}

async function loadIndex(): Promise<SessionIndex> {
    const cached = getIndexCache();
    if (cached) return cached;

    await loadMeta();

    const index =
        (await loadLargeData<SessionIndex>(STORAGE_KEYS.SESSION_INDEX)) ?? {};
    setIndexCache(index);
    return index;
}

async function saveSessions(): Promise<boolean> {
    const cache = getSessionsCache();
    if (!cache) {
        log.warn('saveSessions: No cache to save');
        return false;
    }
    const success = await storeLargeData(
        STORAGE_KEYS.SESSIONS,
        Object.fromEntries(cache),
    );
    if (!success) {
        log.error('Failed to save sessions to storage');
    }
    return success;
}

async function saveIndex(): Promise<boolean> {
    const cache = getIndexCache();
    if (!cache) {
        log.warn('saveIndex: No cache to save');
        return false;
    }
    const success = await storeLargeData(STORAGE_KEYS.SESSION_INDEX, cache);
    if (!success) {
        log.error('Failed to save index to storage');
    }
    return success;
}

// =============================================================================
// MIGRATION
// =============================================================================

async function migrateStorage(meta: StorageMeta): Promise<void> {
    const fromVersion = meta.version ?? 0;

    // Version 0 -> 1: Initial structure
    if (fromVersion < 1) {
        // Nothing to migrate from scratch
    }

    // Version 1 -> 2: Migrate selectedFields to stageFields
    if (fromVersion < 2) {
        const data = await loadLargeData<Record<SessionId, Session>>(
            STORAGE_KEYS.SESSIONS,
        );
        if (data) {
            let migrated = false;
            for (const session of Object.values(data)) {
                // Check if session has old selectedFields but no stageFields
                if (
                    !session.stageFields &&
                    (session as { selectedFields?: unknown }).selectedFields
                ) {
                    const oldFields = (
                        session as { selectedFields: Record<string, unknown> }
                    ).selectedFields;
                    session.stageFields = {
                        base: oldFields as Record<string, boolean | number[]>,
                        linked: true,
                        overrides: {},
                    };
                    // Remove deprecated field from storage
                    delete (session as { selectedFields?: unknown })
                        .selectedFields;
                    migrated = true;
                }
            }
            if (migrated) {
                await storeLargeData(STORAGE_KEYS.SESSIONS, data);
            }
        }
    }

    meta.version = STORAGE_VERSION;
    meta.lastMigration = Date.now();
    await storeLargeData(STORAGE_KEYS.STORAGE_META, meta);
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get all sessions for a character (most recent first).
 */
export async function getSessionsForCharacter(
    characterId: CharacterId,
): Promise<Session[]> {
    const sessions = await loadSessions();
    const index = await loadIndex();

    const ids = index[characterId] ?? [];
    return ids
        .map((id) => sessions.get(id))
        .filter((s): s is Session => s !== undefined);
}

/**
 * Get a session by ID.
 */
export async function getSession(
    sessionId: SessionId,
): Promise<Session | null> {
    const sessions = await loadSessions();
    return sessions.get(sessionId) ?? null;
}

/**
 * Create a new session.
 *
 * @param params - Session creation parameters (primitives only, no domain objects)
 */
export async function createSession(
    params: CreateSessionParams,
): Promise<Session> {
    const { characterId, characterName, stageFields, originalData, configs } =
        params;

    const sessions = await loadSessions();
    const index = await loadIndex();

    const _ = SillyTavern.libs.lodash;

    const session = createDefaultSession(
        crypto.randomUUID(),
        characterId,
        characterName,
    );
    session.stageFields = _.cloneDeep(stageFields);
    session.originalData = _.cloneDeep(originalData);
    session.configs = _.cloneDeep(configs);

    // Add to cache
    sessions.set(session.id, session);

    // Update index (prepend)
    if (!index[characterId]) {
        index[characterId] = [];
    }
    index[characterId].unshift(session.id);

    // Trim old sessions if over limit
    if (index[characterId].length > MAX_SESSIONS_PER_CHARACTER) {
        const toRemove = index[characterId].splice(MAX_SESSIONS_PER_CHARACTER);
        for (const id of toRemove) {
            sessions.delete(id);
        }
    }

    await saveSessions();
    await saveIndex();

    return session;
}

/**
 * Update a session.
 */
export async function updateSession(session: Session): Promise<void> {
    const sessions = await loadSessions();

    // Validate that session exists before updating
    // This prevents bypassing the creation flow (which handles limits, indexing, etc.)
    if (!sessions.has(session.id)) {
        throw new Error(`Cannot update non-existent session: ${session.id}`);
    }

    session.updatedAt = Date.now();
    sessions.set(session.id, session);

    await saveSessions();
}

/**
 * Delete a session.
 */
export async function deleteSession(sessionId: SessionId): Promise<boolean> {
    const sessions = await loadSessions();
    const index = await loadIndex();

    const session = sessions.get(sessionId);
    if (!session) {
        log.warn('deleteSession: Session not found:', sessionId);
        return false;
    }

    // Remove from sessions cache
    sessions.delete(sessionId);

    // Remove from index
    const charIndex = index[session.characterId];
    if (charIndex) {
        const idx = charIndex.indexOf(sessionId);
        if (idx !== -1) charIndex.splice(idx, 1);
        if (charIndex.length === 0) delete index[session.characterId];
    }

    // Persist changes
    const sessionsOk = await saveSessions();
    const indexOk = await saveIndex();

    if (!sessionsOk || !indexOk) {
        log.error('deleteSession: Failed to persist deletion');
        return false;
    }

    log.debug('Session deleted:', sessionId);
    return true;
}

/**
 * Delete all sessions for a character.
 */
export async function deleteAllSessionsForCharacter(
    characterId: CharacterId,
): Promise<{ success: boolean; count: number }> {
    const sessions = await loadSessions();
    const index = await loadIndex();

    const ids = index[characterId] ?? [];
    const count = ids.length;

    if (count === 0) {
        return { success: true, count: 0 };
    }

    for (const id of ids) {
        sessions.delete(id);
    }
    delete index[characterId];

    const sessionsOk = await saveSessions();
    const indexOk = await saveIndex();

    if (!sessionsOk || !indexOk) {
        log.error('deleteAllSessionsForCharacter: Failed to persist');
        return { success: false, count: 0 };
    }

    log.debug(`Deleted ${count} sessions for character:`, characterId);
    return { success: true, count };
}

/**
 * Delete ALL sessions for ALL characters (global purge).
 * This is a destructive operation - use with caution.
 */
export async function purgeAllSessions(): Promise<{
    success: boolean;
    count: number;
}> {
    const sessions = await loadSessions();
    const count = sessions.size;

    if (count === 0) {
        return { success: true, count: 0 };
    }

    // Clear both caches
    sessions.clear();
    setIndexCache({});

    // Persist empty state
    const sessionsOk = await saveSessions();
    const indexOk = await saveIndex();

    if (!sessionsOk || !indexOk) {
        log.error('deleteAllSessions: Failed to persist');
        return { success: false, count: 0 };
    }

    log.info(`Deleted ALL ${count} sessions`);
    return { success: true, count };
}
