// src/ui/formatter/helpers.ts
// =============================================================================
// FORMATTER HELPERS
// =============================================================================

export function escapeHtml(value: unknown): string {
    const { DOMPurify } = SillyTavern.libs;
    const str = typeof value === 'string' ? value : String(value ?? '');
    return DOMPurify.sanitize(str, { ALLOWED_TAGS: [] });
}

export function inferType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

export function isSimpleValue(value: unknown): boolean {
    return (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null
    );
}

export function formatLabel(key: string): string {
    return key
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function findHeroKey(data: Record<string, unknown>): string | null {
    const heroPatterns = [
        'overallscore',
        'totalscore',
        'overall',
        'total',
        'score',
        'rating',
    ];

    for (const pattern of heroPatterns) {
        for (const key of Object.keys(data)) {
            if (
                key.toLowerCase().replace(/_/g, '') === pattern &&
                typeof data[key] === 'number'
            ) {
                return key;
            }
        }
    }

    return null;
}

export function looksLikeScore(label: string, value: number): boolean {
    const scoreWords = [
        'score',
        'rating',
        'rank',
        'grade',
        'level',
        'confidence',
        'quality',
    ];
    if (scoreWords.some((word) => label.includes(word))) return true;
    if (value >= 0 && value <= 10 && Number.isFinite(value)) return true;
    if (value >= 0 && value <= 100 && Number.isInteger(value)) return true;
    return false;
}

export function getScoreColor(score: number): string {
    // Returns CSS color based on score (0-10 scale)
    if (score >= 8) return 'var(--cr-score-high, #10b981)';
    if (score >= 6) return 'var(--cr-score-good, #22c55e)';
    if (score >= 4) return 'var(--cr-score-mid, #eab308)';
    if (score >= 2) return 'var(--cr-score-low, #f97316)';
    return 'var(--cr-score-bad, #ef4444)';
}

export function isUrl(str: string): boolean {
    return /^https?:\/\//i.test(str);
}

export function isEmail(str: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}
