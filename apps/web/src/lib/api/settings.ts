import type { UserSettings, UserSettingsResponse } from '@email-assistant/types';
import { apiRequest } from './client';

const SETTINGS_TIMEOUT = 10000;

export async function getUserSettings(): Promise<UserSettingsResponse> {
  return apiRequest<UserSettingsResponse>('/api/settings', {
    method: 'GET',
    timeout: SETTINGS_TIMEOUT,
  });
}

export async function updateUserSettings(
  settings: Partial<UserSettings>
): Promise<UserSettingsResponse> {
  return apiRequest<UserSettingsResponse>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
    timeout: SETTINGS_TIMEOUT,
  });
}
