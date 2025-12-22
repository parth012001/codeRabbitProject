import type { BriefResponse } from '@email-assistant/types';
import { apiRequest } from './client';

// Extended timeout for AI summary generation (1-2 seconds expected, 15s buffer)
const BRIEF_TIMEOUT = 15000;

/**
 * Fetch the AI-generated brief for the authenticated user
 * Returns email summary, stats, meeting breakdown, and recent emails
 */
export async function getBrief(): Promise<BriefResponse> {
  return apiRequest<BriefResponse>('/api/brief', {
    method: 'GET',
    timeout: BRIEF_TIMEOUT,
  });
}
