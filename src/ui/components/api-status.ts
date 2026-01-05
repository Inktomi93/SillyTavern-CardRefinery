// src/ui/components/api-status.ts
// =============================================================================
// API STATUS & CONNECTION PROFILE SELECTOR
//
// Displays current API status and allows selection of CMRS profiles if available.
// =============================================================================

import {
    MODULE_NAME,
    getApiStatus,
    hasCMRS,
    getAvailableProfiles,
} from '../../shared';
import { getSettings, save } from '../../data';
import { $, on, cx } from './base';
import type { ProfileInfo } from '../../shared/profiles';

// =============================================================================
// STATE
// =============================================================================

let selectedProfileId: string | null = null;

/**
 * Get currently selected profile ID.
 */
export function getSelectedProfile(): string | null {
    return selectedProfileId;
}

/**
 * Set selected profile ID.
 */
export function setSelectedProfile(profileId: string | null): void {
    selectedProfileId = profileId;
}

// =============================================================================
// HTML TEMPLATES
// =============================================================================

function renderProfileOption(
    profile: ProfileInfo,
    isSelected: boolean,
): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;

    return `
        <option value="${profile.id}" 
                ${isSelected ? 'selected' : ''}
                ${!profile.isSupported ? 'disabled' : ''}>
            ${DOMPurify.sanitize(profile.name)} (${DOMPurify.sanitize(profile.model)})
        </option>
    `;
}

/**
 * Render API status indicator with optional profile selector.
 */
export function renderApiStatus(): string {
    const DOMPurify = SillyTavern.libs.DOMPurify;
    const status = getApiStatus(selectedProfileId);
    const cmrsAvailable = hasCMRS();
    const profiles = cmrsAvailable ? getAvailableProfiles() : [];

    const statusIcon = status.isReady
        ? 'fa-circle-check ct-text-success'
        : 'fa-circle-xmark ct-text-danger';

    const statusClass = status.isReady
        ? 'ct-api-status--ready'
        : 'ct-api-status--error';

    // Profile selector (if CMRS available)
    const profileSelector =
        cmrsAvailable && profiles.length > 0
            ? `
        <select id="${MODULE_NAME}_profile_select" 
                class="ct-select ct-select--sm text_pole" 
                aria-label="Connection profile">
            <option value="" ${!selectedProfileId ? 'selected' : ''}>
                Current Settings
            </option>
            ${profiles.map((p) => renderProfileOption(p, p.id === selectedProfileId)).join('')}
        </select>
    `
            : '';

    return `
        <div id="${MODULE_NAME}_api_status" class="ct-api-status ${statusClass}">
            <div class="ct-api-status__indicator">
                <i class="fa-solid ${statusIcon}"></i>
                <span class="ct-api-status__text">${DOMPurify.sanitize(status.modelDisplay)}</span>
            </div>
            ${profileSelector}
            ${
                status.error
                    ? `
                <span class="ct-api-status__error" title="${DOMPurify.sanitize(status.error)}">
                    <i class="fa-solid fa-exclamation-triangle"></i>
                </span>
            `
                    : ''
            }
        </div>
    `;
}

/**
 * Render compact API status for header.
 */
export function renderApiStatusCompact(): string {
    const status = getApiStatus(selectedProfileId);

    const statusIcon = status.isReady
        ? 'fa-circle-check ct-text-success'
        : 'fa-circle-xmark ct-text-danger';

    return `
        <div class="ct-api-badge ${cx(!status.isReady && 'ct-api-badge--error')}" 
             title="${status.statusText}${status.error ? ': ' + status.error : ''}">
            <i class="fa-solid ${statusIcon}"></i>
            <span>${status.modelDisplay}</span>
        </div>
    `;
}

/**
 * Update API status display.
 */
export function updateApiStatus(): void {
    const container = $(`#${MODULE_NAME}_api_status`);
    if (!container) return;

    const parent = container.parentElement;
    if (!parent) return;

    // Re-render the component
    parent.innerHTML = renderApiStatus();

    // Re-bind events
    bindApiStatusEvents(parent);
}

/**
 * Bind API status events.
 */
export function bindApiStatusEvents(container: HTMLElement): () => void {
    const cleanups: Array<() => void> = [];

    const profileSelect = $(
        `#${MODULE_NAME}_profile_select`,
        container,
    ) as HTMLSelectElement;
    if (profileSelect) {
        cleanups.push(
            on(profileSelect, 'change', () => {
                const newProfile = profileSelect.value || null;
                setSelectedProfile(newProfile);

                // Save to settings if you want persistence
                const settings = getSettings();
                (
                    settings as unknown as Record<string, unknown>
                ).selectedProfile = newProfile;
                save();

                // Update display
                updateApiStatus();
            }),
        );
    }

    return () => {
        cleanups.forEach((fn) => fn());
    };
}
