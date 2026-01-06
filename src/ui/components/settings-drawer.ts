// src/ui/components/settings-drawer.ts
// =============================================================================
// SETTINGS DRAWER COMPONENT
// =============================================================================
// Slideout drawer for extension settings (replaces modal).
// Uses the same drawer pattern as preset-drawer.ts.

import {
    MODULE_NAME,
    DISPLAY_NAME,
    VERSION,
    popup,
    toast,
    log,
    getAvailableProfiles,
    getApiStatus,
    hasCMRS,
} from '../../shared';
import type { ProfileInfo, ApiStatus } from '../../shared';
import {
    getSettings,
    save,
    resetSettings,
    BASE_SYSTEM_PROMPT,
    BASE_REFINEMENT_PROMPT,
    purgeAllSessions,
} from '../../data';
import { $, $$, on } from './base';

// =============================================================================
// STATE
// =============================================================================

interface SettingsDrawerState {
    isOpen: boolean;
}

const drawerState: SettingsDrawerState = {
    isOpen: false,
};

let cleanupFns: Array<() => void> = [];

// =============================================================================
// CALLBACKS
// =============================================================================

interface SettingsDrawerCallbacks {
    onClose?: () => void;
}

let drawerCallbacks: SettingsDrawerCallbacks = {};

// =============================================================================
// HTML TEMPLATES
// =============================================================================

/**
 * Render API status banner.
 */
function renderApiStatusBanner(status: ApiStatus): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const settings = getSettings();
    const statusClass = status.isReady
        ? 'cr-api-banner--ready'
        : 'cr-api-banner--error';
    const icon = status.isReady ? 'fa-circle-check' : 'fa-circle-xmark';
    const typeLabel = status.apiType === 'cc' ? 'Chat' : 'Text';

    // Show override value if set, otherwise show API max
    const hasOverride = settings.maxTokensOverride !== null;
    const displayMaxOutput = hasOverride
        ? settings.maxTokensOverride!
        : status.maxOutput;
    const overrideIndicator = hasOverride
        ? '<i class="fa-solid fa-pen cr-api-banner__override-icon" title="Custom output limit active"></i>'
        : '';

    return /* html */ `
        <div class="cr-api-banner ${statusClass}">
            <div class="cr-api-banner__left">
                <i class="fa-solid ${icon}"></i>
                <span class="cr-api-banner__name">${DOMPurify.sanitize(status.displayName)}</span>
                <span class="cr-badge cr-badge--small">${typeLabel}</span>
            </div>
            <div class="cr-api-banner__right">
                <span class="cr-api-banner__model" title="${DOMPurify.sanitize(status.model)}">${DOMPurify.sanitize(status.modelDisplay)}</span>
                <span class="cr-api-banner__limits ${hasOverride ? 'cr-api-banner__limits--override' : ''}">${overrideIndicator}${displayMaxOutput.toLocaleString()}t max</span>
            </div>
        </div>
        ${
            status.error
                ? /* html */ `
            <div class="cr-api-error">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>${DOMPurify.sanitize(status.error)}</span>
            </div>
        `
                : ''
        }
    `;
}

/**
 * Render selected profile info card.
 */
function renderProfileInfo(profile: ProfileInfo | null): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;

    if (!profile) {
        return /* html */ `
            <div class="cr-profile-info cr-profile-info--empty">
                <i class="fa-solid fa-circle-question"></i>
                <span>Select a profile above</span>
            </div>
        `;
    }

    const typeLabel = profile.mode === 'cc' ? 'Chat' : 'Text';

    return /* html */ `
        <div class="cr-profile-info ${!profile.isSupported ? 'cr-profile-info--error' : ''}">
            <div class="cr-profile-info__row">
                <span class="cr-profile-info__label">API</span>
                <span class="cr-profile-info__value">${DOMPurify.sanitize(profile.api)}</span>
            </div>
            <div class="cr-profile-info__row">
                <span class="cr-profile-info__label">Model</span>
                <span class="cr-profile-info__value" title="${DOMPurify.sanitize(profile.model)}">${DOMPurify.sanitize(truncateModel(profile.model))}</span>
            </div>
            <div class="cr-profile-info__row">
                <span class="cr-profile-info__label">Type</span>
                <span class="cr-badge cr-badge--small">${typeLabel}</span>
            </div>
            ${
                profile.presetName
                    ? /* html */ `
                <div class="cr-profile-info__row">
                    <span class="cr-profile-info__label">Preset</span>
                    <span class="cr-profile-info__value">${DOMPurify.sanitize(profile.presetName)}</span>
                </div>
            `
                    : ''
            }
            ${
                !profile.isSupported
                    ? /* html */ `
                <div class="cr-profile-info__error">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <span>${profile.validationError || 'Profile configuration is invalid'}</span>
                </div>
            `
                    : ''
            }
        </div>
    `;
}

/**
 * Truncate model name for display.
 */
function truncateModel(model: string): string {
    const stripped = model
        .replace(/^anthropic\//, '')
        .replace(/^openai\//, '')
        .replace(/^google\//, '')
        .replace(/^meta-llama\//, 'llama-')
        .replace(/^mistralai\//, 'mistral-');

    if (stripped.length > 30) {
        return stripped.substring(0, 27) + '...';
    }
    return stripped;
}

/**
 * Render the drawer container.
 */
function renderDrawer(): string {
    return /* html */ `
        <div id="${MODULE_NAME}_settings_drawer" class="cr-drawer" aria-hidden="true">
            <div class="cr-drawer__backdrop"></div>
            <aside class="cr-drawer__panel" role="dialog" aria-label="${DISPLAY_NAME} Settings">
                <div class="cr-drawer__content">
                    ${renderDrawerHeader()}
                    ${renderDrawerBody()}
                    ${renderDrawerFooter()}
                </div>
            </aside>
        </div>
    `;
}

/**
 * Render the drawer header.
 */
function renderDrawerHeader(): string {
    return /* html */ `
        <header class="cr-drawer__header">
            <div class="cr-drawer__title">
                <i class="fa-solid fa-cog"></i>
                <h3>${DISPLAY_NAME} Settings</h3>
            </div>
            <button id="${MODULE_NAME}_settings_close"
                    class="cr-btn cr-btn--icon cr-btn--ghost menu_button"
                    type="button"
                    title="Close settings">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </header>
    `;
}

/**
 * Render the drawer body with settings sections.
 */
function renderDrawerBody(): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const settings = getSettings();
    const profiles = getAvailableProfiles();
    const apiStatus = getApiStatus(
        settings.generationMode === 'profile' ? settings.profileId : null,
    );

    // Fallback to 'current' mode if no profiles available
    const effectiveMode =
        settings.generationMode === 'profile' && profiles.length === 0
            ? 'current'
            : settings.generationMode;

    return /* html */ `
        <div class="cr-drawer__body">
            <!-- Generation Settings -->
            <section class="cr-settings-section">
                <h3>
                    <i class="fa-solid fa-sliders"></i>
                    Generation
                </h3>

                <!-- Current API Status -->
                <div id="${MODULE_NAME}_api_status_banner">
                    ${renderApiStatusBanner(apiStatus)}
                </div>

                <!-- Mode Toggle -->
                ${
                    hasCMRS()
                        ? /* html */ `
                <div class="cr-gen-mode-toggle">
                    <label class="cr-gen-mode-option ${effectiveMode === 'current' ? 'cr-gen-mode-option--active' : ''}" data-mode="current">
                        <input type="radio" name="${MODULE_NAME}_gen_mode" value="current" ${effectiveMode === 'current' ? 'checked' : ''}/>
                        <i class="fa-solid fa-sliders"></i>
                        <span>Current ST Settings</span>
                    </label>
                    <label class="cr-gen-mode-option ${effectiveMode === 'profile' ? 'cr-gen-mode-option--active' : ''}" data-mode="profile">
                        <input type="radio" name="${MODULE_NAME}_gen_mode" value="profile" ${effectiveMode === 'profile' ? 'checked' : ''}/>
                        <i class="fa-solid fa-plug"></i>
                        <span>Connection Profile</span>
                    </label>
                </div>

                <!-- Profile Selection -->
                <div id="${MODULE_NAME}_profile_section" class="cr-profile-section ${effectiveMode === 'current' ? 'cr-hidden' : ''}">
                    ${
                        profiles.length > 0
                            ? /* html */ `
                    <div class="cr-setting-item">
                        <label class="cr-setting-label">Select Profile</label>
                        <select id="${MODULE_NAME}_profile_select" class="cr-select text_pole">
                            <option value="">-- Select a profile --</option>
                            ${profiles
                                .map(
                                    (p) => /* html */ `
                            <option value="${p.id}"
                                    ${p.id === settings.profileId ? 'selected' : ''}
                                    ${!p.isSupported ? 'disabled' : ''}>
                                ${DOMPurify.sanitize(p.name)}${!p.isSupported ? ' (invalid)' : ''}
                            </option>
                            `,
                                )
                                .join('')}
                        </select>
                    </div>
                    <div id="${MODULE_NAME}_profile_info_container">
                        ${renderProfileInfo(profiles.find((p) => p.id === settings.profileId) || null)}
                    </div>
                    `
                            : /* html */ `
                    <div class="cr-profile-empty">
                        <i class="fa-solid fa-info-circle"></i>
                        <div>
                            <strong>No connection profiles found</strong>
                            <p>Create profiles in SillyTavern's Connection Manager to use specific API configurations.</p>
                        </div>
                    </div>
                    `
                    }
                </div>
                `
                        : ''
                }

                <!-- Max Tokens Override -->
                <details class="cr-collapsible">
                    <summary>Response Length Override</summary>
                    <div class="cr-setting-item">
                        <label class="cr-setting-label">
                            <input type="checkbox"
                                   id="${MODULE_NAME}_max_tokens_enabled"
                                   ${settings.maxTokensOverride !== null ? 'checked' : ''}/>
                            <span>Override max response tokens</span>
                        </label>
                        <input type="number"
                               id="${MODULE_NAME}_max_tokens"
                               class="cr-number-input text_pole"
                               value="${settings.maxTokensOverride ?? 4096}"
                               min="100"
                               max="32000"
                               step="100"
                               ${settings.maxTokensOverride === null ? 'disabled' : ''}/>
                        <span class="cr-setting-hint">
                            Leave unchecked to use the profile's preset settings
                        </span>
                    </div>
                </details>
            </section>

            <!-- System Prompt -->
            <section class="cr-settings-section">
                <h3>
                    <i class="fa-solid fa-terminal"></i>
                    System Prompt
                </h3>
                <p class="cr-setting-desc">
                    The system prompt is sent with every generation. Your additions are appended after the base prompt.
                </p>

                <div class="cr-setting-item">
                    <label class="cr-setting-label">Your Additions</label>
                    <textarea id="${MODULE_NAME}_user_system_prompt"
                              class="cr-textarea text_pole"
                              rows="4"
                              placeholder="Add custom instructions...">${DOMPurify.sanitize(settings.userSystemPrompt)}</textarea>
                </div>

                <details class="cr-collapsible">
                    <summary>Base Prompt</summary>
                    <div class="cr-collapsible__content">
                        <div class="cr-warning-banner">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                            <span>Editing the base prompt may affect results. Use "Revert" to restore defaults.</span>
                        </div>
                        <textarea id="${MODULE_NAME}_base_system_prompt"
                                  class="cr-textarea cr-textarea--compact text_pole"
                                  rows="4">${DOMPurify.sanitize(settings.baseSystemPrompt)}</textarea>
                        <button id="${MODULE_NAME}_revert_system_prompt"
                                class="cr-btn cr-btn--small menu_button cr-mt-2"
                                type="button">
                            <i class="fa-solid fa-rotate-left"></i>
                            Revert to Default
                        </button>
                    </div>
                </details>
            </section>

            <!-- Refinement Prompt -->
            <section class="cr-settings-section">
                <h3>
                    <i class="fa-solid fa-rotate"></i>
                    Refinement Prompt
                </h3>
                <p class="cr-setting-desc">
                    Instructions for refinement iterations. Your additions are appended after the base.
                </p>

                <div class="cr-setting-item">
                    <label class="cr-setting-label">Your Additions</label>
                    <textarea id="${MODULE_NAME}_user_refinement_prompt"
                              class="cr-textarea text_pole"
                              rows="4"
                              placeholder="Add custom refinement instructions...">${DOMPurify.sanitize(settings.userRefinementPrompt)}</textarea>
                </div>

                <details class="cr-collapsible">
                    <summary>Base Prompt</summary>
                    <div class="cr-collapsible__content">
                        <div class="cr-warning-banner">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                            <span>Editing the base prompt may affect results. Use "Revert" to restore defaults.</span>
                        </div>
                        <textarea id="${MODULE_NAME}_base_refinement_prompt"
                                  class="cr-textarea cr-textarea--compact text_pole"
                                  rows="4">${DOMPurify.sanitize(settings.baseRefinementPrompt)}</textarea>
                        <button id="${MODULE_NAME}_revert_refinement_prompt"
                                class="cr-btn cr-btn--small menu_button cr-mt-2"
                                type="button">
                            <i class="fa-solid fa-rotate-left"></i>
                            Revert to Default
                        </button>
                    </div>
                </details>
            </section>

            <!-- Reset Settings -->
            <section class="cr-settings-section">
                <h3>
                    <i class="fa-solid fa-rotate-left"></i>
                    Reset
                </h3>
                <button id="${MODULE_NAME}_reset_settings"
                        class="cr-btn cr-btn--small cr-btn--danger menu_button"
                        type="button">
                    <i class="fa-solid fa-rotate-left"></i>
                    Reset All Settings
                </button>
            </section>

            <!-- Data Management -->
            <section class="cr-settings-section">
                <h3>
                    <i class="fa-solid fa-database"></i>
                    Data Management
                </h3>
                <div class="cr-danger-zone">
                    <div class="cr-danger-zone__warning">
                        <i class="fa-solid fa-skull-crossbones"></i>
                        <div>
                            <strong>Danger Zone</strong>
                            <p>These actions are destructive and cannot be undone.</p>
                        </div>
                    </div>
                    <button id="${MODULE_NAME}_purge_all_sessions"
                            class="menu_button menu_button--danger"
                            type="button">
                        <i class="fa-solid fa-trash"></i>
                        Delete All Sessions (All Characters)
                    </button>
                </div>
            </section>

            <!-- Keyboard Shortcuts -->
            <section class="cr-settings-section">
                <h3>
                    <i class="fa-solid fa-keyboard"></i>
                    Keyboard Shortcuts
                </h3>
                <div class="cr-shortcuts-list">
                    <div class="cr-shortcut">
                        <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
                        <span>Run current stage</span>
                    </div>
                    <div class="cr-shortcut">
                        <kbd>Escape</kbd>
                        <span>Cancel generation</span>
                    </div>
                </div>
            </section>
        </div>
    `;
}

/**
 * Render the drawer footer.
 */
function renderDrawerFooter(): string {
    return /* html */ `
        <footer class="cr-drawer__footer cr-drawer__footer--spaced">
            <span class="cr-version">v${VERSION}</span>
            <button id="${MODULE_NAME}_settings_save"
                    class="cr-btn cr-btn--primary menu_button"
                    type="button">
                <i class="fa-solid fa-check"></i>
                Save & Close
            </button>
        </footer>
    `;
}

// =============================================================================
// API STATUS UPDATE
// =============================================================================

/**
 * Update the API status banner based on current selection.
 */
function updateApiStatusBanner(drawer: HTMLElement, useProfile: boolean): void {
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
function saveSettingsFromDrawer(): void {
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

    save();
    toast.success('Settings saved');
}

// =============================================================================
// EVENT BINDING
// =============================================================================

/**
 * Bind drawer events.
 */
function bindDrawerEvents(drawer: HTMLElement): void {
    // Close button
    const closeBtn = $(`#${MODULE_NAME}_settings_close`, drawer);
    if (closeBtn) {
        cleanupFns.push(
            on(closeBtn, 'click', () => {
                closeSettingsDrawer();
            }),
        );
    }

    // Save button
    const saveBtn = $(`#${MODULE_NAME}_settings_save`, drawer);
    if (saveBtn) {
        cleanupFns.push(
            on(saveBtn, 'click', () => {
                saveSettingsFromDrawer();
                closeSettingsDrawer();
            }),
        );
    }

    // Backdrop click to close
    const backdrop = $('.cr-drawer__backdrop', drawer);
    if (backdrop) {
        cleanupFns.push(
            on(backdrop, 'click', () => {
                closeSettingsDrawer();
            }),
        );
    }

    // Escape key to close
    const escHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && drawerState.isOpen) {
            e.preventDefault();
            e.stopPropagation();
            closeSettingsDrawer();
        }
    };
    document.addEventListener('keydown', escHandler);
    cleanupFns.push(() => document.removeEventListener('keydown', escHandler));

    // Generation mode toggle
    const modeOptions = $$('.cr-gen-mode-option', drawer);
    const profileSection = $(`#${MODULE_NAME}_profile_section`, drawer);

    for (const option of modeOptions) {
        cleanupFns.push(
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
        cleanupFns.push(
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
        cleanupFns.push(
            on(maxTokensEnabled, 'change', () => {
                maxTokensInput.disabled = !maxTokensEnabled.checked;
            }),
        );
    }

    // Reset settings
    const resetBtn = $(`#${MODULE_NAME}_reset_settings`, drawer);
    if (resetBtn) {
        cleanupFns.push(
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
        cleanupFns.push(
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
        cleanupFns.push(
            on(revertRefinementBtn, 'click', () => {
                baseRefinementPromptTextarea.value = BASE_REFINEMENT_PROMPT;
                toast.info('Base refinement prompt reverted to default');
            }),
        );
    }

    // Purge all sessions (global)
    const purgeBtn = $(`#${MODULE_NAME}_purge_all_sessions`, drawer);
    if (purgeBtn) {
        cleanupFns.push(
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

/**
 * Refresh drawer content after reset.
 */
function refreshDrawerContent(): void {
    const drawer = $(`#${MODULE_NAME}_settings_drawer`);
    if (!drawer) return;

    const panel = $('.cr-drawer__panel', drawer);
    if (panel) {
        // Clear old cleanup functions
        cleanupFns.forEach((fn) => fn());
        cleanupFns = [];

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
// LIFECYCLE
// =============================================================================

/**
 * Initialize the settings drawer (create DOM).
 */
export function initSettingsDrawer(container: HTMLElement): void {
    // Check if drawer already exists
    if ($(`#${MODULE_NAME}_settings_drawer`)) {
        return;
    }

    // Find the ST popup dialog (which uses the browser's top layer)
    const popupDialog = container.closest('.popup');
    if (popupDialog) {
        // Append inside the dialog so it stays in the top layer stacking context
        popupDialog.insertAdjacentHTML('beforeend', renderDrawer());
    } else {
        // Fallback to body if no popup found
        document.body.insertAdjacentHTML('beforeend', renderDrawer());
    }
}

/**
 * Show the settings drawer.
 */
export function showSettingsDrawer(callbacks?: SettingsDrawerCallbacks): void {
    const drawer = $(`#${MODULE_NAME}_settings_drawer`);
    if (!drawer) {
        log.error('Settings drawer not initialized');
        return;
    }

    // Clean up any existing event listeners before re-binding
    // This prevents listener accumulation if drawer is reopened without closing
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];

    // Store callbacks
    drawerCallbacks = callbacks || {};

    // Update drawer content
    const panel = $('.cr-drawer__panel', drawer);
    if (panel) {
        panel.innerHTML = /* html */ `
            <div class="cr-drawer__content">
                ${renderDrawerHeader()}
                ${renderDrawerBody()}
                ${renderDrawerFooter()}
            </div>
        `;
    }

    // Bind events
    bindDrawerEvents(drawer);

    // Mark as open
    drawerState.isOpen = true;

    // Show drawer with animation
    requestAnimationFrame(() => {
        drawer.classList.add('cr-drawer--open');
        drawer.setAttribute('aria-hidden', 'false');
    });
}

/**
 * Close the settings drawer.
 */
export function closeSettingsDrawer(): void {
    const drawer = $(`#${MODULE_NAME}_settings_drawer`);
    if (!drawer) return;

    // Guard against double-close during animation
    if (!drawerState.isOpen) return;

    // Mark as closed immediately to prevent race conditions
    drawerState.isOpen = false;

    drawer.classList.remove('cr-drawer--open');
    drawer.setAttribute('aria-hidden', 'true');

    // Cleanup after animation completes
    setTimeout(() => {
        cleanupFns.forEach((fn) => fn());
        cleanupFns = [];
        drawerCallbacks.onClose?.();
    }, 300);
}

/**
 * Destroy the settings drawer (remove from DOM).
 */
export function destroySettingsDrawer(): void {
    const drawer = $(`#${MODULE_NAME}_settings_drawer`);
    if (drawer) {
        drawer.remove();
    }
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];
    drawerState.isOpen = false;
}

// =============================================================================
// CONVENIENCE EXPORT (replaces openSettingsModal)
// =============================================================================

/**
 * Open settings drawer (convenience function).
 * This is the main entry point that replaces openSettingsModal.
 */
export function openSettingsDrawer(
    container: HTMLElement,
    callbacks?: SettingsDrawerCallbacks,
): void {
    initSettingsDrawer(container);
    showSettingsDrawer(callbacks);
}
