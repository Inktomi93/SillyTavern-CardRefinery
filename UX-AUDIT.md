# Character Tools UX Audit Report

**Date:** January 5, 2026
**Version Reviewed:** 2.0.0
**Reviewer:** Claude Code

---

## Executive Summary

This audit identifies UX issues, layout problems, and interaction inconsistencies in the Character Tools extension. Issues are categorized by severity (Critical, High, Medium, Low) with specific CSS class references for targeted fixes.

---

## Table of Contents

1. [Critical Issues](#1-critical-issues)
2. [High Priority Issues](#2-high-priority-issues)
3. [Medium Priority Issues](#3-medium-priority-issues)
4. [Low Priority Issues](#4-low-priority-issues)
5. [Component-by-Component Breakdown](#5-component-by-component-breakdown)
6. [CSS Class Reference](#6-css-class-reference)

---

## 1. Critical Issues

### 1.1 Analyze Tab Missing Label Text

**Location:** Toolbar stage tabs
**Component:** `.ct-stage-tab`

**Problem:**
The Analyze tab displays only a checkbox and icon, with no visible "Analyze" label text. The Score and Rewrite tabs correctly show their labels.

**Screenshot observation:**
- Score tab: ☑ ⭐ Score
- Rewrite tab: ☑ ✏️ Rewrite
- Analyze tab: ☑ 🔍 (no text)

**Relevant CSS:**
```css
.ct-stage-tab__label {
    flex: 1;
}
```

**Recommendation:**
1. Check if the label element is being rendered for Analyze
2. Verify no conditional logic is hiding the label
3. Ensure `.ct-stage-tab__label` has `display: block` or equivalent

---

### 1.2 Settings Modal Layout Overflow

**Location:** Settings modal (gear icon → Settings)
**Component:** `.ct-settings-modal`

**Problem:**
The two-column layout causes severe content truncation. The Presets panel on the right is cut off, showing only partial text fragments like "Pre", "Pror", "Qu". Users must scroll horizontally to see the full content.

**Affected areas:**
- Presets section title truncated
- Preset list items text wrapping badly
- Export/Import buttons partially hidden

**Relevant CSS:**
```css
.ct-settings-modal {
    /* Current width is too narrow for two-column content */
}

.ct-settings-modal__body {
    /* May need overflow handling */
}
```

**Recommendation:**
1. Increase modal `max-width` from current value to at least 900px
2. Add responsive breakpoint to stack columns vertically below 768px
3. Consider making modal width content-aware
4. Add `overflow-x: hidden` to prevent horizontal scroll, forcing content to wrap

---

### 1.3 "Run Score" Button Doesn't Update Per Stage

**Location:** Toolbar pipeline controls
**Component:** `.ct-pipeline-controls`

**Problem:**
When switching between Score, Rewrite, and Analyze tabs, the primary action button always displays "Run Score" instead of contextually updating to "Run Rewrite" or "Run Analyze".

**Expected behavior:**
- Score tab active → "Run Score"
- Rewrite tab active → "Run Rewrite"
- Analyze tab active → "Run Analyze"

**Actual behavior:**
- All tabs → "Run Score"

**Relevant element:** `button[ref_6225]` with class `menu_button--primary`

**Recommendation:**
1. Update button text dynamically based on `activeStage` state
2. Or use generic "Run" label if multi-stage context is preferred
3. The right panel empty state correctly shows "Run Rewrite to see results" when on Rewrite tab, so the logic exists - just need to apply to button

---

## 2. High Priority Issues

### 2.1 Grammar Error: "1 fields" vs "1 field"

**Location:** Character dropdown option cards
**Component:** `.ct-char-option__meta`

**Problem:**
The character metadata displays "1 fields" which is grammatically incorrect. Should use proper singular/plural forms.

**Current:** `🔤 1 fields`
**Expected:** `🔤 1 field`

**Relevant code location:** Character option rendering in `character-search.ts`

**Recommendation:**
```typescript
const fieldText = `${count} field${count !== 1 ? 's' : ''}`;
```

---

### 2.2 Dropdown Panel Semi-Transparency

**Location:** Character selector dropdown
**Component:** `.ct-dropdown__panel`

**Problem:**
When the dropdown is open, the panel has some transparency that allows the toolbar elements behind to show through, causing visual noise and confusion.

**Relevant CSS:**
```css
.ct-dropdown__panel {
    background: var(--ct-bg);
    /* var(--ct-bg) inherits from SmartThemeBlurTintColor which may have transparency */
}
```

**Recommendation:**
1. Override background to a solid color when dropdown is open
2. Or add backdrop blur to mask background content
3. Or increase z-index and add solid backdrop

```css
.ct-dropdown--open .ct-dropdown__panel {
    background: var(--SmartThemeChatBg, #1a1a1a);
    /* Use a solid fallback */
}
```

---

### 2.3 Preset List Items Text Wrapping

**Location:** Settings modal → Presets section
**Component:** Preset list items

**Problem:**
Preset names like "Default Score", "Default Rewrite", "Iteration Analyze" wrap awkwardly onto multiple lines, making the list hard to scan.

**Recommendation:**
1. Widen the presets column
2. Or use `text-overflow: ellipsis` with title attribute for full name on hover
3. Or reduce font size slightly for list items

---

## 3. Medium Priority Issues

### 3.1 Section Visual Hierarchy Weak

**Location:** Left configuration panel
**Component:** `.ct-section`

**Problem:**
The Fields, Prompt, Guidance, and Saved Sessions sections lack clear visual separation. They blend together, making it hard to distinguish section boundaries.

**Current styling:**
```css
.ct-section {
    border-bottom: 1px solid var(--ct-border-muted);
}
```

**Recommendation:**
1. Increase border contrast: `border-bottom: 1px solid var(--ct-border);`
2. Add subtle background alternation
3. Increase vertical padding between sections
4. Add section header background color

```css
.ct-section__header {
    background: var(--ct-bg-secondary);
    padding: var(--ct-space-2) var(--ct-space-3);
    margin: 0 calc(-1 * var(--ct-space-3));
    margin-bottom: var(--ct-space-2);
}
```

---

### 3.2 Fields Row Layout Cramped

**Location:** Fields to Include section
**Component:** `.ct-field-item`

**Problem:**
The checkbox, field name ("Description"), token count ("1.2k"), and expand chevron are visually crowded with insufficient spacing.

**Current layout:** `☐ Description    1.2k ˅`

**Recommendation:**
1. Increase gap between elements
2. Add explicit `min-width` to field name to prevent collapse
3. Consider moving token count to a new line or tooltip

```css
.ct-field-item {
    gap: var(--ct-space-3); /* increase from space-2 */
}

.ct-field-item__name {
    min-width: 100px;
}
```

---

### 3.3 Saved Sessions Drawer Discoverability

**Location:** Bottom of left panel
**Component:** `.ct-drawer`

**Problem:**
The "Saved Sessions (0)" drawer is pinned to the bottom and easily missed. The `>` chevron suggests expansion but there's no visual affordance on hover, and no feedback when empty.

**Recommendations:**
1. Add hover state to indicate interactivity
2. Show "(No sessions yet)" instead of "(0)" for clearer empty state
3. Add subtle animation on hover
4. Consider showing a brief tooltip

```css
.ct-drawer__header:hover {
    background: var(--ct-bg-secondary);
}

.ct-drawer__toggle {
    transition: transform var(--ct-transition-fast);
}

.ct-drawer--open .ct-drawer__toggle {
    transform: rotate(90deg);
}
```

---

### 3.4 Header Icon Buttons Lack Tooltips

**Location:** Header right section
**Component:** `.ct-header__right`

**Problem:**
The download, settings, and close icons have no visible tooltips, forcing users to guess their function.

**Recommendation:**
Add `title` attributes or implement tooltip component:
- Download icon → "Export character"
- Gear icon → "Settings"
- X icon → "Close"

---

## 4. Low Priority Issues

### 4.1 Empty State Generic Messaging

**Location:** Results panel
**Component:** `.ct-empty-state`

**Problem:**
The empty state shows a large icon and "No results yet / Run Score to see results" but doesn't guide new users on the complete workflow.

**Recommendation:**
Add more contextual guidance:
```
No results yet

1. Select a character above
2. Choose fields to include
3. Click "Run Score" to analyze

Or try "Run All" to run the complete pipeline.
```

---

### 4.2 Token Count Positioning

**Location:** Prompt textarea footer
**Component:** Token counter element

**Problem:**
The "~112 tokens" indicator is positioned in the bottom-right corner of the textarea, near the resize handle. It can be easily missed and may be obscured when resizing.

**Recommendation:**
1. Move to section header: "Prompt (~112 tokens)"
2. Or add distinct styling to make more visible
3. Or show in a badge next to the preset selector

---

### 4.3 Guidance Placeholder Text Too Long

**Location:** Guidance textarea
**Component:** Guidance input

**Problem:**
The placeholder "e.g., 'Focus on dialogue quality' or 'Maintain a dark, brooding tone'" is long and wraps, making the empty state look cluttered.

**Recommendation:**
1. Shorten to: "e.g., 'Focus on dialogue quality'"
2. Or move examples to a help tooltip
3. Or use a label above the input instead

---

### 4.4 Modal Backdrop Blur May Impact Performance

**Location:** All modals
**Component:** `.popup:has(.ct-popup)`, `.ct-settings-modal`

**Problem:**
The backdrop blur effect inherited from SillyTavern's theming may cause performance issues on lower-end devices.

**Recommendation:**
Consider adding `@media (prefers-reduced-motion: reduce)` rule to disable blur for users who prefer reduced motion.

---

## 5. Component-by-Component Breakdown

### Header (`.ct-header`)
| Element | Status | Notes |
|---------|--------|-------|
| Character dropdown | ⚠️ | Transparency issue |
| Title + API badge | ✅ | Good |
| Action buttons | ⚠️ | Need tooltips |

### Toolbar (`.ct-toolbar`)
| Element | Status | Notes |
|---------|--------|-------|
| Score tab | ✅ | Good |
| Rewrite tab | ✅ | Good |
| Analyze tab | ❌ | Missing label |
| Run button | ❌ | Doesn't update |
| Other controls | ✅ | Good |

### Configuration Panel (`.ct-panel--config`)
| Element | Status | Notes |
|---------|--------|-------|
| Fields section | ⚠️ | Cramped layout |
| Prompt section | ✅ | Good |
| JSON Schema toggle | ✅ | Good |
| Guidance section | ⚠️ | Long placeholder |
| Saved Sessions | ⚠️ | Low discoverability |

### Results Panel (`.ct-panel--results`)
| Element | Status | Notes |
|---------|--------|-------|
| Empty state | ⚠️ | Generic message |
| Results display | N/A | Not tested |

### Settings Modal (`.ct-settings-modal`)
| Element | Status | Notes |
|---------|--------|-------|
| Generation section | ✅ | Good |
| System Prompt | ✅ | Good |
| Presets section | ❌ | Truncated/overflow |
| Keyboard Shortcuts | ✅ | Good |
| Debug section | ✅ | Good |

### Preset Editor Modal
| Element | Status | Notes |
|---------|--------|-------|
| Name field | ✅ | Good |
| Stage toggles | ✅ | Good |
| Prompt template | ✅ | Good |
| Variables link | ✅ | Good |

---

## 6. CSS Class Reference

### Layout Classes
| Class | Purpose | Issues Found |
|-------|---------|--------------|
| `.ct-popup` | Main popup container | None |
| `.ct-header` | Header bar | None |
| `.ct-toolbar` | Stage tabs + controls | Tab label missing |
| `.ct-body` | Two-panel layout | None |
| `.ct-panel--config` | Left config panel | Section hierarchy |
| `.ct-panel--results` | Right results panel | Empty state |

### Component Classes
| Class | Purpose | Issues Found |
|-------|---------|--------------|
| `.ct-stage-tab` | Individual stage tab | Analyze missing label |
| `.ct-stage-tab__label` | Tab label text | Not rendering for Analyze |
| `.ct-dropdown` | Character selector | Transparency |
| `.ct-dropdown__panel` | Dropdown content | Background bleed |
| `.ct-char-option` | Character list item | None |
| `.ct-char-option__meta` | Character metadata | Grammar ("1 fields") |
| `.ct-section` | Content section | Weak boundaries |
| `.ct-field-item` | Field checkbox row | Cramped spacing |
| `.ct-drawer` | Collapsible drawer | Low discoverability |
| `.ct-empty-state` | Empty results state | Generic messaging |
| `.ct-settings-modal` | Settings modal | Overflow/truncation |

### Utility Classes
| Class | Purpose | Notes |
|-------|---------|-------|
| `.ct-stack` | Vertical flex | Good |
| `.ct-row` | Horizontal flex | Good |
| `.ct-text-muted` | Muted text color | Good |
| `.ct-scrollable` | Scrollable area | Good |

---

## Appendix: Recommended Fix Priority

### Sprint 1 (Critical)
1. Fix Analyze tab label
2. Fix settings modal overflow
3. Fix Run button text

### Sprint 2 (High)
4. Fix "1 fields" grammar
5. Fix dropdown transparency
6. Fix preset list wrapping

### Sprint 3 (Medium)
7. Improve section hierarchy
8. Improve field row spacing
9. Improve drawer discoverability
10. Add icon tooltips

### Backlog (Low)
11. Improve empty state messaging
12. Reposition token counter
13. Shorten guidance placeholder
14. Add reduced motion support

---

*End of UX Audit Report*
