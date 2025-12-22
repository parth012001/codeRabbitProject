import type {
  GmailConnectionStatus,
  GmailConnectResponse,
} from '@email-assistant/types';
import { apiRequest, ApiError } from './client';

const GMAIL_STATUS_TIMEOUT = 10000;
const GMAIL_CONNECT_TIMEOUT = 15000;

export async function checkGmailConnection(): Promise<GmailConnectionStatus> {
  try {
    return await apiRequest<GmailConnectionStatus>('/api/gmail/status', {
      method: 'GET',
      timeout: GMAIL_STATUS_TIMEOUT,
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
    timeout: GMAIL_CONNECT_TIMEOUT,
  });
}

export function redirectToGmailAuth(redirectUrl: string): void {
  window.location.href = redirectUrl;
}
