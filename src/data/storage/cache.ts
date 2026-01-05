// src/data/storage/cache.ts
// =============================================================================
// STORAGE CACHE MANAGEMENT
// =============================================================================

import type {
    Session,
    SessionId,
    SessionIndex,
    StorageMeta,
} from '../../types';

// =============================================================================
// CACHE STATE
// =============================================================================

let sessionsCache: Map<SessionId, Session> | null = null;
let indexCache: SessionIndex | null = null;
let metaCache: StorageMeta | null = null;

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Clear all caches (call on popup close).
 */
export function clearCache(): void {
    sessionsCache = null;
    indexCache = null;
    metaCache = null;
}

// =============================================================================
// INTERNAL CACHE ACCESSORS
// =============================================================================

export function getSessionsCache(): Map<SessionId, Session> | null {
    return sessionsCache;
}

export function setSessionsCache(cache: Map<SessionId, Session>): void {
    sessionsCache = cache;
}

export function getIndexCache(): SessionIndex | null {
    return indexCache;
}

export function setIndexCache(cache: SessionIndex): void {
    indexCache = cache;
}

export function getMetaCache(): StorageMeta | null {
    return metaCache;
}

export function setMetaCache(cache: StorageMeta): void {
    metaCache = cache;
}
