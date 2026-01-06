// src/types/index.ts
// =============================================================================
// TYPE EXPORTS
// =============================================================================
// Barrel file for all type definitions.
// Import from '@/types' or '../types' for clean imports.

// Character types
export type {
    CharacterId,
    CharacterField,
    PopulatedField,
    Character,
} from './character';

// Stage types
export type { StageName, StageStatus, StageConfig, StageResult } from './stage';

// Preset types
export type {
    PresetId,
    PromptPreset,
    SchemaPreset,
    StructuredOutputSchema,
    JsonSchemaValue,
} from './preset';

// Session types
export type { SessionId, Session, SessionIndex, StorageMeta } from './session';

// Settings types
export type { Settings } from './settings';

// State types
export type { FieldSelection, StageFieldSelection, PopupState } from './state';

// Store types (only export what's used externally)
export type { StateSlice } from './store';
