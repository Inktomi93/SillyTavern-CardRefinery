// src/ui/components/preset-drawer/types.ts
// =============================================================================
// TYPES
// =============================================================================

import type { PromptPreset, SchemaPreset } from '../../../types';

export type PresetType = 'prompt' | 'schema';
export type DrawerMode = 'list' | 'create' | 'edit' | 'duplicate';

export interface DrawerState {
    isOpen: boolean;
    type: PresetType;
    mode: DrawerMode;
    preset: PromptPreset | SchemaPreset | null;
    activeTab: 'edit' | 'preview';
}

export interface DrawerCallbacks {
    onSave?: (preset: PromptPreset | SchemaPreset) => void;
    onSelect?: (preset: PromptPreset | SchemaPreset) => void;
    onUpdate?: () => void;
    onClose?: () => void;
}
