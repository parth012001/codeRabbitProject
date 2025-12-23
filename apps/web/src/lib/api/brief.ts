import type { BriefResponse } from '@email-assistant/types';
import { apiRequest } from './client';
import { API_TIMEOUTS } from '../config/timeouts';

/**
 * Fetch the AI-generated brief for the authenticated user
 * Returns email summary, stats, meeting breakdown, and recent emails
 */
export async function getBrief(): Promise<BriefResponse> {
  return apiRequest<BriefResponse>('/api/brief', {
    method: 'GET',
    timeout: API_TIMEOUTS.AI_OPERATION,
  });
}
