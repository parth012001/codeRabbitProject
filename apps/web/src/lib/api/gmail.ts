import type {
  GmailConnectionStatus,
  GmailConnectResponse,
} from '@email-assistant/types';
import { apiRequest, ApiError } from './client';
import { API_TIMEOUTS } from '../config/timeouts';

export async function checkGmailConnection(): Promise<GmailConnectionStatus> {
  try {
    return await apiRequest<GmailConnectionStatus>('/api/gmail/status', {
      method: 'GET',
      timeout: API_TIMEOUTS.STATUS_CHECK,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 408) {
      console.error('Gmail status check timed out');
    }
    throw error;
  }
}

export async function initiateGmailConnection(): Promise<GmailConnectResponse> {
  return apiRequest<GmailConnectResponse>('/api/gmail/connect', {
    method: 'POST',
    timeout: API_TIMEOUTS.CONNECTION,
  });
}

export function redirectToGmailAuth(redirectUrl: string): void {
  window.location.href = redirectUrl;
}
