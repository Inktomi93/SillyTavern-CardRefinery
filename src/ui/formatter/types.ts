// src/ui/formatter/types.ts
// =============================================================================
// FORMATTER TYPES
// =============================================================================

export interface ParsedSection {
    type: 'hero' | 'section' | 'paragraph' | 'list' | 'code';
    title?: string;
    score?: { value: number; max: number };
    content?: string;
    items?: string[];
    listType?: 'bullet' | 'numbered';
    children?: ParsedSection[];
    language?: string;
}

export interface ScoreMatch {
    value: number;
    max: number;
    label?: string;
}

export interface ExtractedList {
    items: string[];
    listType: 'bullet' | 'numbered';
}
