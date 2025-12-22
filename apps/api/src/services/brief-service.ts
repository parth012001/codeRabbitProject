import OpenAI from 'openai';
import { getEmailsForBrief } from './processed-email-service.js';
import type { ProcessedEmail } from '../db/index.js';

// Lazy-initialized OpenAI client (avoids crashing server if env var is missing)
let openaiClient: OpenAI | null = null;

/**
 * Get OpenAI client with lazy initialization
 * Throws only when the Brief feature is actually used, not at module load
 */
function getOpenAIClient(): OpenAI {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for brief generation');
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

/**
 * Brief statistics
 */
export interface BriefStats {
  total: number;
  meetings: number;
  urgent: number;
}

/**
 * Meeting emails grouped by availability status
 */
export interface MeetingBreakdown {
  available: ProcessedEmail[];
  busy: ProcessedEmail[];
  unknown: ProcessedEmail[];
}

/**
 * Complete brief result
 */
export interface BriefResult {
  summary: string;
  stats: BriefStats;
  meetingBreakdown: MeetingBreakdown;
  draftsReady: number;
  emails: ProcessedEmail[];
  generatedAt: string;
}

/**
 * Extract sender name from email "from" field
 * Handles formats like "John Doe <john@example.com>" and "john@example.com"
 */
function extractSenderName(from: string): string {
  // Try to extract name from "Name <email>" format
  const match = from.match(/^([^<]+)</);
  if (match) {
    return match[1].trim();
  }
  // Return the email part before @
  const emailMatch = from.match(/([^@]+)@/);
  if (emailMatch) {
    return emailMatch[1];
  }
  return from;
}

/**
 * Generate AI summary of emails using o4-mini
 */
async function generateAISummary(emails: ProcessedEmail[]): Promise<string> {
  if (emails.length === 0) {
    return 'No emails to summarize in the last 24 hours.';
  }

  // Build context from emails
  const emailContext = emails
    .map((e) => {
      const tags = [];
      if (e.isMeetingRequest) tags.push('[MEETING]');
      if (e.isUrgent) tags.push('[URGENT]');
      const tagStr = tags.length > 0 ? ` ${tags.join(' ')}` : '';
      return `- From: ${extractSenderName(e.from)}\n  Subject: ${e.subject || '(no subject)'}${tagStr}`;
    })
    .join('\n');

  const prompt = `You are an executive assistant providing a brief summary of recent emails.

Here are the ${emails.length} most recent emails from the last 24 hours:

${emailContext}

Provide a concise 2-3 sentence executive summary like a chief of staff would give. Focus on:
- Key themes or topics across the emails
- Any urgent items that need attention
- Important meetings or requests

Be direct and informative. Do not use bullet points. Write in complete sentences.`;

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an executive assistant that provides concise, insightful email summaries. Be direct and professional.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || 'Unable to generate summary.';
  } catch (error) {
    console.error('[BriefService] Error generating AI summary:', error);
    return 'Unable to generate summary at this time.';
  }
}

/**
 * Generate a brief for a user
 * Fetches last 10 emails from the past 24 hours and generates statistics + AI summary
 *
 * @param userId - Clerk user ID
 * @returns BriefResult with summary, stats, and email details
 */
export async function generateBrief(userId: string): Promise<BriefResult> {
  console.log(`[BriefService] Generating brief for user: ${userId.substring(0, 8)}...`);

  // Fetch emails from the last 24 hours, max 10
  const emails = await getEmailsForBrief(userId, 24, 10);

  console.log(`[BriefService] Found ${emails.length} emails in last 24h`);

  // Compute stats
  const stats: BriefStats = {
    total: emails.length,
    meetings: emails.filter((e) => e.isMeetingRequest).length,
    urgent: emails.filter((e) => e.isUrgent).length,
  };

  // Group meetings by availability status
  const meetingEmails = emails.filter((e) => e.isMeetingRequest);
  const meetingBreakdown: MeetingBreakdown = {
    available: meetingEmails.filter((e) => e.availabilityStatus === 'available'),
    busy: meetingEmails.filter((e) => e.availabilityStatus === 'busy'),
    unknown: meetingEmails.filter((e) => e.availabilityStatus === 'unknown'),
  };

  // Count drafts ready
  const draftsReady = emails.filter((e) => e.draftId).length;

  // Generate AI summary
  const summary = await generateAISummary(emails);

  console.log(
    `[BriefService] Brief generated: ${stats.total} emails, ${stats.meetings} meetings, ${stats.urgent} urgent`
  );

  return {
    summary,
    stats,
    meetingBreakdown,
    draftsReady,
    emails,
    generatedAt: new Date().toISOString(),
  };
}
