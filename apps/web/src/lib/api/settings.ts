import type { UserSettings, UserSettingsResponse } from '@email-assistant/types';
import { apiRequest } from './client';
import { API_TIMEOUTS } from '../config/timeouts';

export async function getUserSettings(): Promise<UserSettingsResponse> {
  return apiRequest<UserSettingsResponse>('/api/settings', {
    method: 'GET',
    timeout: API_TIMEOUTS.STATUS_CHECK,
  });
}

export async function updateUserSettings(
  settings: Partial<UserSettings>
): Promise<UserSettingsResponse> {
  return apiRequest<UserSettingsResponse>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
    timeout: API_TIMEOUTS.STATUS_CHECK,
  });
}
