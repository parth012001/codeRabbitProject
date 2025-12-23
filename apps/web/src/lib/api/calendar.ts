import type { CalendarConnectionStatus, CalendarConnectResponse } from '@email-assistant/types';
import { apiRequest } from './client';
import { API_TIMEOUTS } from '../config/timeouts';

export async function checkCalendarConnection(): Promise<CalendarConnectionStatus> {
  return apiRequest<CalendarConnectionStatus>('/api/calendar/status', {
    method: 'GET',
    timeout: API_TIMEOUTS.STATUS_CHECK,
  });
}

export async function initiateCalendarConnection(): Promise<CalendarConnectResponse> {
  return apiRequest<CalendarConnectResponse>('/api/calendar/connect', {
    method: 'POST',
    timeout: API_TIMEOUTS.CONNECTION,
  });
}

export function openCalendarAuthPopup(redirectUrl: string): Window | null {
  return window.open(redirectUrl, '_blank', 'noopener,noreferrer');
}
