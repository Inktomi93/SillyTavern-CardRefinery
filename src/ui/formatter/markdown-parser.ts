// src/ui/formatter/markdown-parser.ts
// =============================================================================
// MARKDOWN STRUCTURE DETECTION
// =============================================================================

import type { ParsedSection, ScoreMatch, ExtractedList } from './types';

/**
 * Parse markdown into structured sections for rich rendering
 */
export function parseMarkdownSections(text: string): ParsedSection[] {
    const lines = text.split('\n');
    const sections: ParsedSection[] = [];
    let currentSection: ParsedSection | null = null;
    let contentBuffer: string[] = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeBuffer: string[] = [];

    const flushContent = () => {
        if (contentBuffer.length === 0) return;

        const content = contentBuffer.join('\n').trim();
        if (!content) {
            contentBuffer = [];
            return;
        }

        // Try to extract list items
        const extractedList = extractListItems(content);

        // Check if there's text before the list
        const contentLines = content.split('\n');
        const prefixLines: string[] = [];

        for (let i = 0; i < contentLines.length; i++) {
            const line = contentLines[i];
            if (
                line.match(/^[\s]*[-*•]\s+.+$/) ||
                line.match(/^[\s]*\d+[.)]\s+.+$/)
            ) {
                break;
            }
            if (line.trim()) {
                prefixLines.push(line);
            }
        }

        // Add prefix text as paragraph(s)
        if (prefixLines.length > 0 && extractedList) {
            const prefixContent = prefixLines.join('\n').trim();
            if (prefixContent) {
                const paragraphs = prefixContent.split(/\n\n+/);
                for (const para of paragraphs) {
                    if (!para.trim()) continue;
                    const section: ParsedSection = {
                        type: 'paragraph',
                        content: para.trim(),
                    };
                    if (currentSection) {
                        currentSection.children = currentSection.children || [];
                        currentSection.children.push(section);
                    } else {
                        sections.push(section);
                    }
                }
            }
        }

        // Add list if we found items
        if (extractedList) {
            const section: ParsedSection = {
                type: 'list',
                items: extractedList.items,
                listType: extractedList.listType,
            };
            if (currentSection) {
                currentSection.children = currentSection.children || [];
                currentSection.children.push(section);
            } else {
                sections.push(section);
            }
        } else {
            // No list found - parse as paragraph(s) with potential inline scores
            const paragraphs = content.split(/\n\n+/);
            for (const para of paragraphs) {
                if (!para.trim()) continue;
                const section: ParsedSection = {
                    type: 'paragraph',
                    content: para.trim(),
                };
                if (currentSection) {
                    currentSection.children = currentSection.children || [];
                    currentSection.children.push(section);
                } else {
                    sections.push(section);
                }
            }
        }
        contentBuffer = [];
    };

    const flushCode = () => {
        if (codeBuffer.length === 0) return;
        const section: ParsedSection = {
            type: 'code',
            content: codeBuffer.join('\n'),
            language: codeLanguage,
        };
        if (currentSection) {
            currentSection.children = currentSection.children || [];
            currentSection.children.push(section);
        } else {
            sections.push(section);
        }
        codeBuffer = [];
        codeLanguage = '';
    };

    for (const line of lines) {
        // Skip horizontal rules
        if (/^[-*_]{3,}\s*$/.test(line.trim())) {
            continue;
        }

        // Code block handling
        const codeBlockStart = line.match(/^```(\w*)/);
        if (codeBlockStart) {
            if (inCodeBlock) {
                // End of code block
                flushCode();
                inCodeBlock = false;
            } else {
                // Start of code block
                flushContent();
                inCodeBlock = true;
                codeLanguage = codeBlockStart[1] || '';
            }
            continue;
        }

        if (inCodeBlock) {
            codeBuffer.push(line);
            continue;
        }

        // Check for headers
        const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
        if (headerMatch) {
            flushContent();

            // Save current section if exists (only if it has content)
            if (currentSection) {
                // Only push if section has children or a score
                if (
                    (currentSection.children &&
                        currentSection.children.length > 0) ||
                    currentSection.score
                ) {
                    sections.push(currentSection);
                }
            }

            const level = headerMatch[1].length;
            const title = headerMatch[2].trim();

            // Check for hero patterns (main score/title)
            const heroScore = extractHeroScore(title);
            if (heroScore && level === 1) {
                sections.push({
                    type: 'hero',
                    title: heroScore.label,
                    score: { value: heroScore.value, max: heroScore.max },
                });
                currentSection = null;
            } else {
                currentSection = {
                    type: 'section',
                    title,
                    children: [],
                };

                // Check if title contains a score
                const titleScore = extractScore(title);
                if (titleScore) {
                    currentSection.score = {
                        value: titleScore.value,
                        max: titleScore.max,
                    };
                    currentSection.title = title
                        .replace(/\s*[\d.]+\s*\/\s*\d+\s*$/, '')
                        .trim();
                }
            }
            continue;
        }

        // Check for standalone score line (like "Score: 8/10" or "8/10")
        const standaloneScore = extractStandaloneScore(line);
        if (standaloneScore && currentSection) {
            currentSection.score = {
                value: standaloneScore.value,
                max: standaloneScore.max,
            };
            continue;
        }

        // Check for bold label lines like "**Strengths:**" - treat as sub-section
        const boldLabelMatch = line.match(/^\*\*([^*]+):\*\*\s*$/);
        if (boldLabelMatch && currentSection) {
            flushContent();
            // Add as a styled label paragraph
            const labelSection: ParsedSection = {
                type: 'paragraph',
                content: line, // Keep the bold markers for inline formatting
            };
            currentSection.children = currentSection.children || [];
            currentSection.children.push(labelSection);
            continue;
        }

        // Regular content
        contentBuffer.push(line);
    }

    // Flush remaining content
    flushContent();
    if (inCodeBlock) flushCode();
    // Only push final section if it has content
    if (
        currentSection &&
        ((currentSection.children && currentSection.children.length > 0) ||
            currentSection.score)
    ) {
        sections.push(currentSection);
    }

    // Post-process: detect hero if first section looks like overall score
    if (sections.length > 0 && sections[0].type === 'section') {
        const first = sections[0];
        if (first.score && isHeroTitle(first.title || '')) {
            sections[0] = {
                type: 'hero',
                title: first.title,
                score: first.score,
            };
            // Move children to next position
            if (first.children && first.children.length > 0) {
                sections.splice(1, 0, ...first.children.map((c) => c));
            }
        }
    }

    return sections;
}

/**
 * Extract list items from content.
 * Now handles content that has leading text before the list starts.
 * Returns items array and list type (bullet or numbered).
 */
export function extractListItems(content: string): ExtractedList | null {
    const lines = content.split('\n');
    const items: string[] = [];
    let currentItem = '';
    let foundListStart = false;
    let listType: 'bullet' | 'numbered' = 'bullet';

    for (const line of lines) {
        const bulletMatch = line.match(/^[\s]*[-*•]\s+(.+)$/);
        const numberedMatch = line.match(/^[\s]*\d+[.)]\s+(.+)$/);

        if (bulletMatch || numberedMatch) {
            if (!foundListStart) {
                foundListStart = true;
                listType = numberedMatch ? 'numbered' : 'bullet';
            }
            if (currentItem) items.push(currentItem.trim());
            currentItem = (bulletMatch || numberedMatch)![1];
        } else if (foundListStart && currentItem && line.match(/^\s+\S/)) {
            // Continuation of list item (indented with content)
            currentItem += ' ' + line.trim();
        } else if (line.trim() === '') {
            // Empty line - finalize current item if any
            if (currentItem) items.push(currentItem.trim());
            currentItem = '';
        } else if (foundListStart && line.trim()) {
            // Non-empty, non-list, non-continuation line after list started
            // End the list here - don't swallow unrelated content
            if (currentItem) items.push(currentItem.trim());
            break;
        }
        // If we haven't found list start yet, skip non-list lines
        // (they'll be handled as prefix text in flushContent)
    }

    if (currentItem) items.push(currentItem.trim());

    if (items.length === 0) return null;
    return { items, listType };
}

/**
 * Extract score from text (e.g., "8/10", "Score: 85/100")
 */
export function extractScore(text: string): ScoreMatch | null {
    // Match patterns like "8/10", "85/100", "Score: 6/10"
    const match = text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
    if (match) {
        const value = parseFloat(match[1]);
        const max = parseInt(match[2], 10);
        if (!isNaN(value) && !isNaN(max) && max > 0) {
            return { value, max };
        }
    }
    return null;
}

/**
 * Extract standalone score line
 */
export function extractStandaloneScore(line: string): ScoreMatch | null {
    const trimmed = line.trim();
    // Match "Score: X/Y" or just "X/Y" on its own line
    const match = trimmed.match(
        /^(?:score\s*:?\s*)?(\d+(?:\.\d+)?)\s*\/\s*(\d+)$/i,
    );
    if (match) {
        const value = parseFloat(match[1]);
        const max = parseInt(match[2], 10);
        if (!isNaN(value) && !isNaN(max) && max > 0) {
            return { value, max };
        }
    }
    return null;
}

/**
 * Extract hero score from title (for main title with score)
 */
export function extractHeroScore(title: string): ScoreMatch | null {
    const score = extractScore(title);
    if (score) {
        const label = title.replace(/\s*[\d.]+\s*\/\s*\d+\s*$/, '').trim();
        return { ...score, label };
    }
    return null;
}

/**
 * Check if title looks like a hero/overall score
 */
export function isHeroTitle(title: string): boolean {
    const lower = title.toLowerCase().replace(/[_-]/g, '');
    const heroPatterns = [
        'overall',
        'total',
        'final',
        'summary',
        'verdict',
        'rating',
        'soulcheck',
    ];
    return heroPatterns.some((p) => lower.includes(p));
}
