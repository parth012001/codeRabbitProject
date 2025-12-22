import type { CalendarConnectionStatus, CalendarConnectResponse } from '@email-assistant/types';
import { apiRequest } from './client';

const CALENDAR_STATUS_TIMEOUT = 10000;
const CALENDAR_CONNECT_TIMEOUT = 15000;

export async function checkCalendarConnection(): Promise<CalendarConnectionStatus> {
  return apiRequest<CalendarConnectionStatus>('/api/calendar/status', {
    method: 'GET',
    timeout: CALENDAR_STATUS_TIMEOUT,
  });
}

export async function initiateCalendarConnection(): Promise<CalendarConnectResponse> {
  return apiRequest<CalendarConnectResponse>('/api/calendar/connect', {
    method: 'POST',
    timeout: CALENDAR_CONNECT_TIMEOUT,
  });
}

export function redirectToCalendarAuth(redirectUrl: string): void {
  window.location.href = redirectUrl;
}
