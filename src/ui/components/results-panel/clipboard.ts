// src/ui/components/results-panel/clipboard.ts
// =============================================================================
// CLIPBOARD UTILITIES
// =============================================================================

/**
 * Copy text to clipboard with fallback for insecure contexts.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Fall through to fallback
        }
    }

    // Fallback for insecure contexts (e.g., HTTP, iframes)
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
    } catch {
        return false;
    }
}
