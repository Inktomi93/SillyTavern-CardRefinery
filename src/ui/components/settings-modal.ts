// src/ui/components/settings-modal.ts
// =============================================================================
// SETTINGS MODAL COMPONENT
// =============================================================================

import {
    MODULE_NAME,
    DISPLAY_NAME,
    VERSION,
    popup,
    toast,
    getAvailableProfiles,
    getApiStatus,
    hasCMRS,
} from '../../shared';
import type { ProfileInfo, ApiStatus } from '../../shared';
import { getSettings, save, resetSettings } from '../../data';
import { $, $$, on } from './base';

// =============================================================================
// HTML TEMPLATES
// =============================================================================

/**
 * Render API status banner.
 */
function renderApiStatusBanner(status: ApiStatus): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const statusClass = status.isReady
        ? 'cr-api-banner--ready'
        : 'cr-api-banner--error';
    const icon = status.isReady ? 'fa-circle-check' : 'fa-circle-xmark';
    const typeLabel = status.apiType === 'cc' ? 'Chat' : 'Text';

    return `
        <div class="cr-api-banner ${statusClass}">
            <div class="cr-api-banner__left">
                <i class="fa-solid ${icon}"></i>
                <span class="cr-api-banner__name">${DOMPurify.sanitize(status.displayName)}</span>
                <span class="cr-badge cr-badge--small">${typeLabel}</span>
            </div>
            <div class="cr-api-banner__right">
                <span class="cr-api-banner__model" title="${DOMPurify.sanitize(status.model)}">${DOMPurify.sanitize(status.modelDisplay)}</span>
                <span class="cr-api-banner__limits">${status.maxOutput.toLocaleString()}t max</span>
            </div>
        </div>
        ${
            status.error
                ? `
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
        return `
            <div class="cr-profile-info cr-profile-info--empty">
                <i class="fa-solid fa-circle-question"></i>
                <span>Select a profile above</span>
            </div>
        `;
    }

    const typeLabel = profile.mode === 'cc' ? 'Chat' : 'Text';

    return `
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
                    ? `
                <div class="cr-profile-info__row">
                    <span class="cr-profile-info__label">Preset</span>
                    <span class="cr-profile-info__value">${DOMPurify.sanitize(profile.presetName)}</span>
                </div>
            `
                    : ''
            }
            ${
                !profile.isSupported
                    ? `
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
 * Update the API status banner based on current selection.
 */
function updateApiStatusBanner(modal: HTMLElement, useProfile: boolean): void {
    const banner = $(`#${MODULE_NAME}_api_status_banner`, modal);
    if (!banner) return;

    let profileId: string | null = null;
    if (useProfile) {
        const profileSelect = $(
            `#${MODULE_NAME}_profile_select`,
            modal,
        ) as HTMLSelectElement | null;
        profileId = profileSelect?.value || null;
    }

    const status = getApiStatus(profileId);
    banner.innerHTML = renderApiStatusBanner(status);
}

/**
 * Render settings modal content.
 */
export function renderSettingsModal(): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const settings = getSettings();
    const profiles = getAvailableProfiles();
    const apiStatus = getApiStatus(
        settings.generationMode === 'profile' ? settings.profileId : null,
    );

    return `
        <div id="${MODULE_NAME}_settings_modal" class="cr-settings-modal">
            <div class="cr-settings-header">
                <h2>
                    <i class="fa-solid fa-cog"></i>
                    ${DISPLAY_NAME} Settings
                </h2>
            </div>

            <div class="cr-settings-body">
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
                            ? `
                    <div class="cr-gen-mode-toggle">
                        <label class="cr-gen-mode-option ${settings.generationMode === 'current' ? 'cr-gen-mode-option--active' : ''}" data-mode="current">
                            <input type="radio" name="${MODULE_NAME}_gen_mode" value="current" ${settings.generationMode === 'current' ? 'checked' : ''}>
                            <i class="fa-solid fa-sliders"></i>
                            <span>Current ST Settings</span>
                        </label>
                        <label class="cr-gen-mode-option ${settings.generationMode === 'profile' ? 'cr-gen-mode-option--active' : ''}" data-mode="profile">
                            <input type="radio" name="${MODULE_NAME}_gen_mode" value="profile" ${settings.generationMode === 'profile' ? 'checked' : ''}>
                            <i class="fa-solid fa-plug"></i>
                            <span>Connection Profile</span>
                        </label>
                    </div>

                    <!-- Profile Selection -->
                    <div id="${MODULE_NAME}_profile_section" class="cr-profile-section ${settings.generationMode === 'current' ? 'cr-hidden' : ''}">
                        ${
                            profiles.length > 0
                                ? `
                        <div class="cr-setting-item">
                            <label class="cr-setting-label">Select Profile</label>
                            <select id="${MODULE_NAME}_profile_select" class="cr-select text_pole">
                                <option value="">-- Select a profile --</option>
                                ${profiles
                                    .map(
                                        (p) => `
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
                                : `
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
                                       ${settings.maxTokensOverride !== null ? 'checked' : ''} />
                                <span>Override max response tokens</span>
                            </label>
                            <input type="number"
                                   id="${MODULE_NAME}_max_tokens"
                                   class="cr-number-input text_pole"
                                   value="${settings.maxTokensOverride ?? 4096}"
                                   min="100"
                                   max="32000"
                                   step="100"
                                   ${settings.maxTokensOverride === null ? 'disabled' : ''} />
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
                        <summary>Base Prompt (Read-only)</summary>
                        <pre class="cr-readonly-text">${DOMPurify.sanitize(settings.baseSystemPrompt)}</pre>
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
                        <summary>Base Prompt (Read-only)</summary>
                        <pre class="cr-readonly-text">${DOMPurify.sanitize(settings.baseRefinementPrompt)}</pre>
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
            </div>

            <div class="cr-settings-footer">
                <span class="cr-version">v${VERSION}</span>
                <button id="${MODULE_NAME}_settings_close"
                        class="cr-btn cr-btn--primary menu_button"
                        type="button">
                    <i class="fa-solid fa-check"></i>
                    Save & Close
                </button>
            </div>
        </div>
    `;
}

/**
 * Open settings modal.
 */
export async function openSettingsModal(): Promise<void> {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const context = SillyTavern.getContext();

    const content = renderSettingsModal();

    const popup = new context.Popup(
        DOMPurify.sanitize(content),
        context.POPUP_TYPE.TEXT,
        '',
        {
            wide: true,
            large: true,
            allowVerticalScrolling: true,
            okButton: false,
            cancelButton: false,
        },
    );

    popup.show();

    // Wait for DOM
    await new Promise((resolve) => setTimeout(resolve, 0));

    const modal = $(`#${MODULE_NAME}_settings_modal`);
    if (!modal) return;

    // Bind events
    const cleanup = bindSettingsModalEvents(modal);

    // Handle close
    const closeBtn = $(`#${MODULE_NAME}_settings_close`, modal);
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            saveSettings();
            cleanup();

            // Find and click popup close button
            const dialog = modal.closest('.popup');
            const popupCloseBtn = dialog?.querySelector(
                '.popup-button-cancel, .popup-button-ok',
            ) as HTMLElement;
            popupCloseBtn?.click();
        });
    }
}

/**
 * Save current settings from form.
 */
function saveSettings(): void {
    const settings = getSettings();

    // Generation mode
    const modeRadio = document.querySelector(
        `input[name="${MODULE_NAME}_gen_mode"]:checked`,
    ) as HTMLInputElement | null;
    if (modeRadio) {
        settings.generationMode = modeRadio.value as 'current' | 'profile';
    }

    // Profile selection
    const profileSelect = $(
        `#${MODULE_NAME}_profile_select`,
    ) as HTMLSelectElement | null;
    if (profileSelect) {
        settings.profileId = profileSelect.value || null;
    }

    // Max tokens override
    const maxTokensEnabled = $(
        `#${MODULE_NAME}_max_tokens_enabled`,
    ) as HTMLInputElement;
    const maxTokensInput = $(`#${MODULE_NAME}_max_tokens`) as HTMLInputElement;
    if (maxTokensEnabled && maxTokensInput) {
        settings.maxTokensOverride = maxTokensEnabled.checked
            ? parseInt(maxTokensInput.value, 10)
            : null;
    }

    // System prompt
    const userSystemPrompt = $(
        `#${MODULE_NAME}_user_system_prompt`,
    ) as HTMLTextAreaElement;
    if (userSystemPrompt) {
        settings.userSystemPrompt = userSystemPrompt.value;
    }

    // Refinement prompt
    const userRefinementPrompt = $(
        `#${MODULE_NAME}_user_refinement_prompt`,
    ) as HTMLTextAreaElement;
    if (userRefinementPrompt) {
        settings.userRefinementPrompt = userRefinementPrompt.value;
    }

    save();
    toast.success('Settings saved');
}

/**
 * Bind settings modal events.
 */
function bindSettingsModalEvents(modal: HTMLElement): () => void {
    const cleanups: Array<() => void> = [];

    // Generation mode toggle
    const modeOptions = $$('.cr-gen-mode-option', modal);
    const profileSection = $(`#${MODULE_NAME}_profile_section`, modal);

    for (const option of modeOptions) {
        cleanups.push(
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
                updateApiStatusBanner(modal, mode === 'profile');
            }),
        );
    }

    // Profile selection
    const profileSelect = $(
        `#${MODULE_NAME}_profile_select`,
        modal,
    ) as HTMLSelectElement | null;
    const profileInfoContainer = $(
        `#${MODULE_NAME}_profile_info_container`,
        modal,
    );

    if (profileSelect && profileInfoContainer) {
        cleanups.push(
            on(profileSelect, 'change', () => {
                const profiles = getAvailableProfiles();
                const selected = profiles.find(
                    (p) => p.id === profileSelect.value,
                );
                profileInfoContainer.innerHTML = renderProfileInfo(
                    selected || null,
                );

                // Update API status banner
                updateApiStatusBanner(modal, true);
            }),
        );
    }

    // Max tokens toggle
    const maxTokensEnabled = $(
        `#${MODULE_NAME}_max_tokens_enabled`,
        modal,
    ) as HTMLInputElement;
    const maxTokensInput = $(
        `#${MODULE_NAME}_max_tokens`,
        modal,
    ) as HTMLInputElement;
    if (maxTokensEnabled && maxTokensInput) {
        cleanups.push(
            on(maxTokensEnabled, 'change', () => {
                maxTokensInput.disabled = !maxTokensEnabled.checked;
            }),
        );
    }

    // Reset settings
    const resetBtn = $(`#${MODULE_NAME}_reset_settings`, modal);
    if (resetBtn) {
        cleanups.push(
            on(resetBtn, 'click', async () => {
                const confirm = await popup.confirm(
                    'Reset Settings',
                    'This will reset all settings to defaults. Custom presets will be kept. Continue?',
                );
                if (!confirm) return;

                resetSettings();
                toast.success('Settings reset to defaults');

                // Close and reopen to refresh
                const dialog = modal.closest('.popup');
                const closeBtn = dialog?.querySelector(
                    '.popup-button-cancel, .popup-button-ok',
                ) as HTMLElement;
                closeBtn?.click();

                // Reopen
                setTimeout(() => openSettingsModal(), 100);
            }),
        );
    }

    return () => {
        cleanups.forEach((fn) => fn());
    };
}
