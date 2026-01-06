// src/data/storage/index.ts
// =============================================================================
// STORAGE MODULE EXPORTS
// =============================================================================

// Cache management
export { clearCache } from './cache';

// Session CRUD
export {
    getSessionsForCharacter,
    getSession,
    createSession,
    updateSession,
    deleteSession,
    deleteAllSessionsForCharacter,
    purgeAllSessions,
    type CreateSessionParams,
} from './sessions';
