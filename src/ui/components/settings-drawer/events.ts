// src/ui/components/settings-drawer/events.ts
// =============================================================================
// EVENT HANDLING
// =============================================================================

import {
    MODULE_NAME,
    popup,
    toast,
    log,
    getAvailableProfiles,
    getApiStatus,
} from '../../../shared';
import {
    getSettings,
    save,
    resetSettings,
    BASE_SYSTEM_PROMPT,
    BASE_REFINEMENT_PROMPT,
    purgeAllSessions,
} from '../../../data';
import { $, $$, on } from '../base';
import { isDrawerOpen, addCleanupFn, clearCleanupFns } from './state';
import {
    renderApiStatusBanner,
    renderProfileInfo,
    renderDrawerHeader,
    renderDrawerBody,
    renderDrawerFooter,
} from './templates';
import { closeSettingsDrawer } from './lifecycle';

// =============================================================================
// API STATUS UPDATE
// =============================================================================

/**
 * Update the API status banner based on current selection.
 */
export function updateApiStatusBanner(
    drawer: HTMLElement,
    useProfile: boolean,
): void {
    const banner = $(`#${MODULE_NAME}_api_status_banner`, drawer);
    if (!banner) return;

    let profileId: string | null = null;
    if (useProfile) {
        const profileSelect = $(
            `#${MODULE_NAME}_profile_select`,
            drawer,
        ) as HTMLSelectElement | null;
        profileId = profileSelect?.value || null;
    }

    const status = getApiStatus(profileId);
    banner.innerHTML = renderApiStatusBanner(status);
}

// =============================================================================
// SETTINGS SAVE
// =============================================================================

/**
 * Save current settings from form.
 */
export function saveSettingsFromDrawer(): void {
    const settings = getSettings();
    const drawer = $(`#${MODULE_NAME}_settings_drawer`);
    if (!drawer) return;

    // Generation mode
    const modeRadio = drawer.querySelector(
        `input[name="${MODULE_NAME}_gen_mode"]:checked`,
    ) as HTMLInputElement | null;
    if (modeRadio) {
        settings.generationMode = modeRadio.value as 'current' | 'profile';
    }

    // Profile selection
    const profileSelect = $(
        `#${MODULE_NAME}_profile_select`,
        drawer,
    ) as HTMLSelectElement | null;
    if (profileSelect) {
        settings.profileId = profileSelect.value || null;
    }

    // Max tokens override
    const maxTokensEnabled = $(
        `#${MODULE_NAME}_max_tokens_enabled`,
        drawer,
    ) as HTMLInputElement;
    const maxTokensInput = $(
        `#${MODULE_NAME}_max_tokens`,
        drawer,
    ) as HTMLInputElement;
    if (maxTokensEnabled && maxTokensInput) {
        settings.maxTokensOverride = maxTokensEnabled.checked
            ? parseInt(maxTokensInput.value, 10)
            : null;
    }

    // System prompt
    const userSystemPrompt = $(
        `#${MODULE_NAME}_user_system_prompt`,
        drawer,
    ) as HTMLTextAreaElement;
    if (userSystemPrompt) {
        settings.userSystemPrompt = userSystemPrompt.value;
    }

    // Refinement prompt
    const userRefinementPrompt = $(
        `#${MODULE_NAME}_user_refinement_prompt`,
        drawer,
    ) as HTMLTextAreaElement;
    if (userRefinementPrompt) {
        settings.userRefinementPrompt = userRefinementPrompt.value;
    }

    // Base system prompt
    const baseSystemPrompt = $(
        `#${MODULE_NAME}_base_system_prompt`,
        drawer,
    ) as HTMLTextAreaElement;
    if (baseSystemPrompt) {
        settings.baseSystemPrompt = baseSystemPrompt.value;
    }

    // Base refinement prompt
    const baseRefinementPrompt = $(
        `#${MODULE_NAME}_base_refinement_prompt`,
        drawer,
    ) as HTMLTextAreaElement;
    if (baseRefinementPrompt) {
        settings.baseRefinementPrompt = baseRefinementPrompt.value;
    }

    // Replace {{user}} macro setting
    const replaceUserMacro = $(
        `#${MODULE_NAME}_replace_user_macro`,
        drawer,
    ) as HTMLInputElement;
    if (replaceUserMacro) {
        settings.replaceUserMacro = replaceUserMacro.checked;
    }

    // Disable thinking mode
    const disableThinking = $(
        `#${MODULE_NAME}_disable_thinking`,
        drawer,
    ) as HTMLInputElement;
    if (disableThinking) {
        settings.disableThinking = disableThinking.checked;
    }

    // Assistant prefill settings
    const useAssistantPrefill = $(
        `#${MODULE_NAME}_use_assistant_prefill`,
        drawer,
    ) as HTMLInputElement;
    if (useAssistantPrefill) {
        settings.useAssistantPrefill = useAssistantPrefill.checked;
    }

    const assistantPrefill = $(
        `#${MODULE_NAME}_assistant_prefill`,
        drawer,
    ) as HTMLInputElement;
    if (assistantPrefill) {
        settings.assistantPrefill = assistantPrefill.value;
    }

    save();
    toast.success('Settings saved');
}

// =============================================================================
// DRAWER CONTENT REFRESH
// =============================================================================

/**
 * Refresh drawer content after reset.
 */
export function refreshDrawerContent(): void {
    const drawer = $(`#${MODULE_NAME}_settings_drawer`);
    if (!drawer) return;

    const panel = $('.cr-drawer__panel', drawer);
    if (panel) {
        // Clear old cleanup functions
        clearCleanupFns();

        // Re-render content
        panel.innerHTML = /* html */ `
            <div class="cr-drawer__content">
                ${renderDrawerHeader()}
                ${renderDrawerBody()}
                ${renderDrawerFooter()}
            </div>
        `;

        // Re-bind events
        bindDrawerEvents(drawer);
    }
}

// =============================================================================
// EVENT BINDING
// =============================================================================

/**
 * Bind drawer events.
 */
export function bindDrawerEvents(drawer: HTMLElement): void {
    // Close button
    const closeBtn = $(`#${MODULE_NAME}_settings_close`, drawer);
    if (closeBtn) {
        addCleanupFn(
            on(closeBtn, 'click', () => {
                closeSettingsDrawer();
            }),
        );
    }

    // Save button
    const saveBtn = $(`#${MODULE_NAME}_settings_save`, drawer);
    if (saveBtn) {
        addCleanupFn(
            on(saveBtn, 'click', () => {
                saveSettingsFromDrawer();
                closeSettingsDrawer();
            }),
        );
    }

    // Backdrop click to close
    const backdrop = $('.cr-drawer__backdrop', drawer);
    if (backdrop) {
        addCleanupFn(
            on(backdrop, 'click', () => {
                closeSettingsDrawer();
            }),
        );
    }

    // Escape key to close
    const escHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isDrawerOpen()) {
            e.preventDefault();
            e.stopPropagation();
            closeSettingsDrawer();
        }
    };
    document.addEventListener('keydown', escHandler);
    addCleanupFn(() => document.removeEventListener('keydown', escHandler));

    // Generation mode toggle
    const modeOptions = $$('.cr-gen-mode-option', drawer);
    const profileSection = $(`#${MODULE_NAME}_profile_section`, drawer);

    for (const option of modeOptions) {
        addCleanupFn(
            on(option, 'click', () => {
                const mode = (option as HTMLElement).dataset.mode;

                // Update active styling
                modeOptions.forEach((o) =>
                    o.classList.remove('cr-gen-mode-option--active'),
                );
                option.classList.add('cr-gen-mode-option--active');

                // Show/hide profile section
                if (profileSection) {
                    profileSection.classList.toggle(
                        'cr-hidden',
                        mode === 'current',
                    );
                }

                // Update API status banner
                updateApiStatusBanner(drawer, mode === 'profile');
            }),
        );
    }

    // Profile selection
    const profileSelect = $(
        `#${MODULE_NAME}_profile_select`,
        drawer,
    ) as HTMLSelectElement | null;
    const profileInfoContainer = $(
        `#${MODULE_NAME}_profile_info_container`,
        drawer,
    );

    if (profileSelect && profileInfoContainer) {
        addCleanupFn(
            on(profileSelect, 'change', () => {
                const profiles = getAvailableProfiles();
                const selected = profiles.find(
                    (p) => p.id === profileSelect.value,
                );
                profileInfoContainer.innerHTML = renderProfileInfo(
                    selected || null,
                );

                // Update API status banner
                updateApiStatusBanner(drawer, true);
            }),
        );
    }

    // Max tokens toggle
    const maxTokensEnabled = $(
        `#${MODULE_NAME}_max_tokens_enabled`,
        drawer,
    ) as HTMLInputElement;
    const maxTokensInput = $(
        `#${MODULE_NAME}_max_tokens`,
        drawer,
    ) as HTMLInputElement;
    if (maxTokensEnabled && maxTokensInput) {
        addCleanupFn(
            on(maxTokensEnabled, 'change', () => {
                maxTokensInput.disabled = !maxTokensEnabled.checked;
            }),
        );
    }

    // Assistant prefill toggle - show/hide prefill input
    const useAssistantPrefill = $(
        `#${MODULE_NAME}_use_assistant_prefill`,
        drawer,
    ) as HTMLInputElement;
    const prefillContainer = $(`#${MODULE_NAME}_prefill_container`, drawer);
    if (useAssistantPrefill && prefillContainer) {
        addCleanupFn(
            on(useAssistantPrefill, 'change', () => {
                prefillContainer.style.display = useAssistantPrefill.checked
                    ? ''
                    : 'none';
            }),
        );
    }

    // Reset settings
    const resetBtn = $(`#${MODULE_NAME}_reset_settings`, drawer);
    if (resetBtn) {
        addCleanupFn(
            on(resetBtn, 'click', async () => {
                const confirm = await popup.confirm(
                    'Reset Settings',
                    'This will reset all settings to defaults. Custom presets will be kept. Continue?',
                );
                if (!confirm) return;

                resetSettings();
                toast.success('Settings reset to defaults');

                // Refresh drawer content
                refreshDrawerContent();
            }),
        );
    }

    // Revert base system prompt
    const revertSystemBtn = $(`#${MODULE_NAME}_revert_system_prompt`, drawer);
    const baseSystemPromptTextarea = $(
        `#${MODULE_NAME}_base_system_prompt`,
        drawer,
    ) as HTMLTextAreaElement | null;
    if (revertSystemBtn && baseSystemPromptTextarea) {
        addCleanupFn(
            on(revertSystemBtn, 'click', () => {
                baseSystemPromptTextarea.value = BASE_SYSTEM_PROMPT;
                toast.info('Base system prompt reverted to default');
            }),
        );
    }

    // Revert base refinement prompt
    const revertRefinementBtn = $(
        `#${MODULE_NAME}_revert_refinement_prompt`,
        drawer,
    );
    const baseRefinementPromptTextarea = $(
        `#${MODULE_NAME}_base_refinement_prompt`,
        drawer,
    ) as HTMLTextAreaElement | null;
    if (revertRefinementBtn && baseRefinementPromptTextarea) {
        addCleanupFn(
            on(revertRefinementBtn, 'click', () => {
                baseRefinementPromptTextarea.value = BASE_REFINEMENT_PROMPT;
                toast.info('Base refinement prompt reverted to default');
            }),
        );
    }

    // Purge all sessions (global)
    const purgeBtn = $(`#${MODULE_NAME}_purge_all_sessions`, drawer);
    if (purgeBtn) {
        addCleanupFn(
            on(purgeBtn, 'click', async () => {
                const confirmed = await popup.confirm(
                    'Delete ALL Sessions?',
                    'This will permanently delete ALL sessions for ALL characters. This action cannot be undone.',
                );
                if (!confirmed) return;

                try {
                    const result = await purgeAllSessions();
                    if (result.success) {
                        toast.success(
                            `Deleted ${result.count} session${result.count !== 1 ? 's' : ''} across all characters`,
                        );
                    } else {
                        toast.error('Failed to delete sessions');
                    }
                } catch (error) {
                    toast.error('Failed to delete sessions');
                    log.error('Purge all sessions error:', error);
                }
            }),
        );
    }
}
