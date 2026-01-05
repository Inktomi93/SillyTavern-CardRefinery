/**
 * Session Storage Tests
 *
 * Tests for session CRUD operations, storage migration,
 * and character-scoped session management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock shared module
vi.mock('../../src/shared', async () => {
    const actual = await vi.importActual('../../src/shared');
    return {
        ...actual,
        STORAGE_KEYS: {
            SESSIONS: 'cr_sessions',
            SESSION_INDEX: 'cr_session_index',
            STORAGE_META: 'cr_storage_meta',
        },
        STORAGE_VERSION: 2,
        MAX_SESSIONS_PER_CHARACTER: 5,
        loadLargeData: vi.fn(),
        storeLargeData: vi.fn(),
        log: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    };
});

// Mock cache module
const mockCache = {
    sessions: null as Map<string, unknown> | null,
    index: null as Record<string, string[]> | null,
    meta: null as { version: number; lastMigration: number } | null,
};

vi.mock('../../src/data/storage/cache', () => ({
    getSessionsCache: vi.fn(() => mockCache.sessions),
    setSessionsCache: vi.fn((cache) => {
        mockCache.sessions = cache;
    }),
    getIndexCache: vi.fn(() => mockCache.index),
    setIndexCache: vi.fn((cache) => {
        mockCache.index = cache;
    }),
    getMetaCache: vi.fn(() => mockCache.meta),
    setMetaCache: vi.fn((cache) => {
        mockCache.meta = cache;
    }),
    clearCache: vi.fn(() => {
        mockCache.sessions = null;
        mockCache.index = null;
        mockCache.meta = null;
    }),
}));

// Mock defaults module
vi.mock('../../src/data/settings', () => ({
    createDefaultSession: vi.fn(
        (id: string, characterId: string, characterName: string) => ({
            id,
            characterId,
            characterName,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            stageFields: { base: {}, linked: true, overrides: {} },
            originalData: {},
            configs: {
                score: {},
                rewrite: {},
                analyze: {},
            },
            history: [],
            iterationCount: 0,
            status: 'active',
            version: 2,
        }),
    ),
}));

import { loadLargeData, storeLargeData } from '../../src/shared';
import {
    createSession,
    getSession,
    getSessionsForCharacter,
    updateSession,
    deleteSession,
    deleteAllSessionsForCharacter,
    renameSession,
    getSessionCount,
} from '../../src/data/storage/sessions';
import type { StageConfig } from '../../src/types';

// =============================================================================
// TEST FIXTURES
// =============================================================================

/** Creates a valid mock StageConfig for testing */
function createMockStageConfig(
    overrides: Partial<StageConfig> = {},
): StageConfig {
    return {
        promptPresetId: null,
        customPrompt: '',
        schemaPresetId: null,
        customSchema: '',
        useStructuredOutput: false,
        ...overrides,
    };
}

/** Creates a valid configs object for session creation */
function createMockConfigs() {
    return {
        score: createMockStageConfig(),
        rewrite: createMockStageConfig(),
        analyze: createMockStageConfig(),
    };
}

function resetMockStorage() {
    mockCache.sessions = null;
    mockCache.index = null;
    mockCache.meta = null;

    vi.mocked(loadLargeData).mockReset();
    vi.mocked(storeLargeData).mockReset();

    // Default: return current version meta
    vi.mocked(loadLargeData).mockImplementation(async (key: string) => {
        if (key === 'cr_storage_meta') {
            return { version: 2, lastMigration: Date.now() };
        }
        if (key === 'cr_sessions') {
            return {};
        }
        if (key === 'cr_session_index') {
            return {};
        }
        return null;
    });

    vi.mocked(storeLargeData).mockResolvedValue(true);
}

// =============================================================================
// TESTS: Session Creation
// =============================================================================

describe('Session Creation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMockStorage();
    });

    describe('createSession', () => {
        it('creates a new session with provided data', async () => {
            const session = await createSession({
                characterId: 'char-1',
                characterName: 'Test Hero',
                stageFields: {
                    base: { description: true },
                    linked: true,
                    overrides: {},
                },
                originalData: { description: 'A hero.' },
                configs: {
                    score: { customPrompt: 'Score it' } as StageConfig,
                    rewrite: {} as StageConfig,
                    analyze: {} as StageConfig,
                },
            });

            expect(session.id).toBeDefined();
            expect(session.characterId).toBe('char-1');
            expect(session.characterName).toBe('Test Hero');
        });

        it('adds session to index', async () => {
            await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            expect(mockCache.index?.['char-1']).toBeDefined();
            expect(mockCache.index?.['char-1'].length).toBe(1);
        });

        it('prepends new sessions to index (most recent first)', async () => {
            await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            const firstId = mockCache.index?.['char-1'][0];

            await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            // Second session should be first in index
            expect(mockCache.index?.['char-1'][1]).toBe(firstId);
        });

        it('enforces max sessions per character limit', async () => {
            // Create 6 sessions (limit is 5)
            for (let i = 0; i < 6; i++) {
                await createSession({
                    characterId: 'char-1',
                    characterName: 'Hero',
                    stageFields: { base: {}, linked: true, overrides: {} },
                    originalData: {},
                    configs: createMockConfigs(),
                });
            }

            expect(mockCache.index?.['char-1'].length).toBe(5);
        });

        it('saves to storage after creation', async () => {
            await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            expect(storeLargeData).toHaveBeenCalledWith(
                'cr_sessions',
                expect.any(Object),
            );
            expect(storeLargeData).toHaveBeenCalledWith(
                'cr_session_index',
                expect.any(Object),
            );
        });
    });
});

// =============================================================================
// TESTS: Session Retrieval
// =============================================================================

describe('Session Retrieval', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMockStorage();
    });

    describe('getSession', () => {
        it('returns session by ID', async () => {
            const created = await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            const found = await getSession(created.id);

            expect(found).not.toBeNull();
            expect(found?.id).toBe(created.id);
        });

        it('returns null for non-existent ID', async () => {
            const found = await getSession('non-existent');
            expect(found).toBeNull();
        });
    });

    describe('getSessionsForCharacter', () => {
        it('returns all sessions for character', async () => {
            await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });
            await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            const sessions = await getSessionsForCharacter('char-1');

            expect(sessions).toHaveLength(2);
        });

        it('returns sessions in most recent first order', async () => {
            const first = await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });
            const second = await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            const sessions = await getSessionsForCharacter('char-1');

            expect(sessions[0].id).toBe(second.id);
            expect(sessions[1].id).toBe(first.id);
        });

        it('returns empty array for character with no sessions', async () => {
            const sessions = await getSessionsForCharacter('char-no-sessions');
            expect(sessions).toEqual([]);
        });

        it('only returns sessions for specified character', async () => {
            await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });
            await createSession({
                characterId: 'char-2',
                characterName: 'Villain',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            const char1Sessions = await getSessionsForCharacter('char-1');
            const char2Sessions = await getSessionsForCharacter('char-2');

            expect(char1Sessions).toHaveLength(1);
            expect(char2Sessions).toHaveLength(1);
            expect(char1Sessions[0].characterName).toBe('Hero');
            expect(char2Sessions[0].characterName).toBe('Villain');
        });
    });

    describe('getSessionCount', () => {
        it('returns count for character', async () => {
            await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });
            await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            const count = await getSessionCount('char-1');

            expect(count).toBe(2);
        });

        it('returns 0 for character with no sessions', async () => {
            const count = await getSessionCount('no-sessions');
            expect(count).toBe(0);
        });
    });
});

// =============================================================================
// TESTS: Session Updates
// =============================================================================

describe('Session Updates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMockStorage();
    });

    describe('updateSession', () => {
        it('updates session data', async () => {
            const session = await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            session.iterationCount = 5;
            await updateSession(session);

            const updated = await getSession(session.id);
            expect(updated?.iterationCount).toBe(5);
        });

        it('updates updatedAt timestamp', async () => {
            const session = await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            const originalUpdatedAt = session.updatedAt;

            // Small delay
            await new Promise((r) => setTimeout(r, 10));

            session.name = 'Renamed';
            await updateSession(session);

            const updated = await getSession(session.id);
            expect(updated?.updatedAt).toBeGreaterThan(originalUpdatedAt);
        });

        it('saves to storage', async () => {
            const session = await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            vi.mocked(storeLargeData).mockClear();

            session.name = 'Updated';
            await updateSession(session);

            expect(storeLargeData).toHaveBeenCalledWith(
                'cr_sessions',
                expect.any(Object),
            );
        });
    });

    describe('renameSession', () => {
        it('renames session', async () => {
            const session = await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            await renameSession(session.id, 'My Custom Name');

            const updated = await getSession(session.id);
            expect(updated?.name).toBe('My Custom Name');
        });

        it('trims whitespace from name', async () => {
            const session = await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            await renameSession(session.id, '  Spaces  ');

            const updated = await getSession(session.id);
            expect(updated?.name).toBe('Spaces');
        });

        it('sets name to undefined for empty string', async () => {
            const session = await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            session.name = 'Has Name';
            await updateSession(session);

            await renameSession(session.id, '');

            const updated = await getSession(session.id);
            expect(updated?.name).toBeUndefined();
        });

        it('handles non-existent session gracefully', async () => {
            // Should not throw
            await expect(
                renameSession('non-existent', 'New Name'),
            ).resolves.not.toThrow();
        });
    });
});

// =============================================================================
// TESTS: Session Deletion
// =============================================================================

describe('Session Deletion', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMockStorage();
    });

    describe('deleteSession', () => {
        it('removes session from cache', async () => {
            const session = await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            await deleteSession(session.id);

            const found = await getSession(session.id);
            expect(found).toBeNull();
        });

        it('removes session from index', async () => {
            // Create two sessions so deleting one doesn't remove the character
            await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });
            const session = await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            await deleteSession(session.id);

            expect(mockCache.index?.['char-1']).not.toContain(session.id);
            expect(mockCache.index?.['char-1']?.length).toBe(1);
        });

        it('removes character from index when last session deleted', async () => {
            const session = await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            await deleteSession(session.id);

            expect(mockCache.index?.['char-1']).toBeUndefined();
        });

        it('handles non-existent session gracefully', async () => {
            await expect(deleteSession('non-existent')).resolves.not.toThrow();
        });

        it('saves to storage after deletion', async () => {
            const session = await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            vi.mocked(storeLargeData).mockClear();

            await deleteSession(session.id);

            expect(storeLargeData).toHaveBeenCalledWith(
                'cr_sessions',
                expect.any(Object),
            );
            expect(storeLargeData).toHaveBeenCalledWith(
                'cr_session_index',
                expect.any(Object),
            );
        });
    });

    describe('deleteAllSessionsForCharacter', () => {
        it('removes all sessions for character', async () => {
            await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });
            await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            await deleteAllSessionsForCharacter('char-1');

            const sessions = await getSessionsForCharacter('char-1');
            expect(sessions).toHaveLength(0);
        });

        it('does not affect other characters', async () => {
            await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });
            await createSession({
                characterId: 'char-2',
                characterName: 'Villain',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            await deleteAllSessionsForCharacter('char-1');

            const char2Sessions = await getSessionsForCharacter('char-2');
            expect(char2Sessions).toHaveLength(1);
        });

        it('removes character from index', async () => {
            await createSession({
                characterId: 'char-1',
                characterName: 'Hero',
                stageFields: { base: {}, linked: true, overrides: {} },
                originalData: {},
                configs: createMockConfigs(),
            });

            await deleteAllSessionsForCharacter('char-1');

            expect(mockCache.index?.['char-1']).toBeUndefined();
        });
    });
});

// =============================================================================
// TESTS: Storage Migration
// =============================================================================

describe('Storage Migration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMockStorage();
    });

    it('initializes meta on first access', async () => {
        vi.mocked(loadLargeData).mockImplementation(async (key: string) => {
            if (key === 'cr_storage_meta') return null;
            return {};
        });

        await createSession({
            characterId: 'char-1',
            characterName: 'Hero',
            stageFields: { base: {}, linked: true, overrides: {} },
            originalData: {},
            configs: createMockConfigs(),
        });

        expect(storeLargeData).toHaveBeenCalledWith(
            'cr_storage_meta',
            expect.objectContaining({ version: 2 }),
        );
    });

    it('migrates selectedFields to stageFields', async () => {
        // Simulate old format session
        const oldSession = {
            id: 'old-session',
            characterId: 'char-1',
            characterName: 'Old Hero',
            selectedFields: { description: true, personality: true },
            // No stageFields property
        };

        vi.mocked(loadLargeData).mockImplementation(async (key: string) => {
            if (key === 'cr_storage_meta') {
                return { version: 1 }; // Old version triggers migration
            }
            if (key === 'cr_sessions') {
                return { 'old-session': oldSession };
            }
            if (key === 'cr_session_index') {
                return { 'char-1': ['old-session'] };
            }
            return null;
        });

        // Trigger load which runs migration
        await getSessionsForCharacter('char-1');

        // Should have stored migrated data
        expect(storeLargeData).toHaveBeenCalledWith(
            'cr_sessions',
            expect.objectContaining({
                'old-session': expect.objectContaining({
                    stageFields: expect.objectContaining({
                        base: { description: true, personality: true },
                        linked: true,
                    }),
                }),
            }),
        );
    });
});

// =============================================================================
// TESTS: Cache Behavior
// =============================================================================

describe('Cache Behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMockStorage();
    });

    it('uses cached data on subsequent calls', async () => {
        await createSession({
            characterId: 'char-1',
            characterName: 'Hero',
            stageFields: { base: {}, linked: true, overrides: {} },
            originalData: {},
            configs: createMockConfigs(),
        });

        vi.mocked(loadLargeData).mockClear();

        // Second retrieval should use cache
        await getSessionsForCharacter('char-1');

        // Should not call loadLargeData again for sessions
        expect(loadLargeData).not.toHaveBeenCalledWith('cr_sessions');
    });
});
