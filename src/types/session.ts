// src/types/session.ts
// =============================================================================
// SESSION TYPE DEFINITIONS
// =============================================================================

import type { CharacterId } from './character';
import type { StageName, StageConfig, StageResult } from './stage';
import type { FieldSelection, StageFieldSelection } from './state';

/**
 * Unique identifier for a session.
 */
export type SessionId = string;

/**
 * A saved work session for a character.
 */
export interface Session {
    id: SessionId;
    characterId: CharacterId;
    characterName: string;
    name?: string; // User-provided name
    createdAt: number;
    updatedAt: number;
    /** @deprecated Use stageFields instead. Kept for migration compatibility. */
    selectedFields?: FieldSelection;
    /** Per-stage field selections with linking support */
    stageFields: StageFieldSelection;
    originalData: Record<string, string>;
    configs: Record<StageName, StageConfig>;
    /** Current result per stage (persisted separately from history for restore support) */
    stageResults?: Record<StageName, StageResult | null>;
    history: StageResult[];
    iterationCount: number;
    /** User guidance for this session */
    userGuidance?: string;
    status: 'active' | 'completed' | 'abandoned';
    version: number;
}

/**
 * Index mapping character IDs to their session IDs.
 */
export interface SessionIndex {
    [characterId: CharacterId]: SessionId[];
}

/**
 * Storage metadata for migrations.
 */
export interface StorageMeta {
    version: number;
    lastMigration: number;
}
