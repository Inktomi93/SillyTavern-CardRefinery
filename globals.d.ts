export {};

// 1. Import when extension is user-scoped
import "../../../../public/global";
// 2. Import when extension is server-scoped
import "../../../../global";

// =============================================================================
// GLOBAL TYPE DECLARATIONS
// =============================================================================

declare global {
    /**
     * Toastr notification library (globally available in ST).
     * Use for user feedback on operations.
     */
    const toastr: {
        success(message: string, title?: string, options?: Record<string, unknown>): void;
        error(message: string, title?: string, options?: Record<string, unknown>): void;
        warning(message: string, title?: string, options?: Record<string, unknown>): void;
        info(message: string, title?: string, options?: Record<string, unknown>): void;
        clear(): void;
    };
}
