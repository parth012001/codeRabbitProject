import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

// ============================================================================
// Schema Definitions
// ============================================================================

/**
 * Schema for a single proposed meeting time extracted from email
 */
const ProposedTimeSchema = z.object({
  date: z.string().describe('The proposed date in ISO format (YYYY-MM-DD)'),
  startTime: z.string().describe('The proposed start time in ISO format (HH:MM) in 24-hour format'),
  endTime: z
    .string()
    .nullable()
    .describe('The proposed end time in ISO format (HH:MM) if specified, null otherwise'),
  timezone: z
    .string()
    .nullable()
    .describe('The timezone if mentioned (e.g., PST, EST, UTC), null if not specified'),
  isFlexible: z
    .boolean()
    .describe('True if the time is flexible/suggested, false if it appears fixed'),
});

/**
 * Schema for the complete meeting classification result
 */
const MeetingClassificationSchema = z.object({
  isMeetingRequest: z.boolean().describe('True if this email is requesting or proposing a meeting'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score between 0 and 1 for the classification'),
  meetingType: z
    .enum(['one-on-one', 'group', 'interview', 'call', 'video-call', 'in-person', 'unknown'])
    .describe('The type of meeting being requested'),
  meetingPurpose: z
    .string()
    .nullable()
    .describe('Brief description of the meeting purpose if identifiable'),
  proposedTimes: z.array(ProposedTimeSchema).describe('Array of proposed meeting times found in the email'),
  durationMinutes: z
    .number()
    .nullable()
    .describe('The proposed meeting duration in minutes if specified'),
  isUrgent: z.boolean().describe('True if the meeting request appears urgent or time-sensitive'),
  requiresResponse: z
    .boolean()
    .describe('True if the sender is clearly expecting a response about availability'),
  extractedDetails: z.object({
    location: z.string().nullable().describe('Meeting location if specified'),
    attendees: z.array(z.string()).describe('Other attendees mentioned'),
    platform: z
      .string()
      .nullable()
      .describe('Meeting platform if mentioned (Zoom, Google Meet, Teams, etc.)'),
  }),
});

// ============================================================================
// Types (exported from schema)
// ============================================================================

export type ProposedTime = z.infer<typeof ProposedTimeSchema>;
export type MeetingClassification = z.infer<typeof MeetingClassificationSchema>;

// ============================================================================
// OpenAI Client Initialization
// ============================================================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required for meeting detection');
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect if an email is a meeting request and extract relevant details
 * Uses OpenAI structured outputs for reliable parsing
 *
 * @param email - The email content to analyze
 * @returns MeetingClassification with detection results
 */
export async function detectMeetingRequest(email: {
  from: string;
  subject: string;
  body: string;
}): Promise<MeetingClassification> {
  const currentDate = new Date().toISOString().split('T')[0];

  const systemPrompt = `You are an expert email analyst specializing in detecting meeting and scheduling requests.

Your task is to analyze the email and determine:
1. Whether this is a meeting/scheduling request
2. Extract any proposed times/dates for the meeting
3. Identify the type and purpose of the meeting
4. Note any urgency indicators

IMPORTANT GUIDELINES:
- A meeting request typically includes phrases like "let's meet", "schedule a call", "can we chat", "are you available", "set up a meeting"
- Look for specific dates, times, or relative time references (tomorrow, next week, etc.)
- Convert relative dates to absolute dates based on today's date: ${currentDate}
- If a time range is given like "2-3 PM", extract both start and end times
- If only duration is mentioned (e.g., "30 minutes"), include it in durationMinutes
- Be conservative: if unsure whether it's a meeting request, set confidence lower

Today's date for reference: ${currentDate}`;

  const userPrompt = `Analyze this email for meeting/scheduling requests:

From: ${email.from}
Subject: ${email.subject}

Body:
${email.body}`;

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(MeetingClassificationSchema, 'meeting_classification'),
      temperature: 0.1, // Low temperature for consistent classification
    });

    const result = completion.choices[0]?.message?.parsed;

    if (!result) {
      console.error('[MeetingDetector] No parsed result from OpenAI');
      return getDefaultClassification();
    }

    console.log(
      `[MeetingDetector] Classification: isMeeting=${result.isMeetingRequest}, confidence=${result.confidence}, times=${result.proposedTimes.length}`
    );

    return result;
  } catch (error) {
    console.error('[MeetingDetector] Error detecting meeting request:', error);
    return getDefaultClassification();
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Returns a default classification for error cases
 */
function getDefaultClassification(): MeetingClassification {
  return {
    isMeetingRequest: false,
    confidence: 0,
    meetingType: 'unknown',
    meetingPurpose: null,
    proposedTimes: [],
    durationMinutes: null,
    isUrgent: false,
    requiresResponse: false,
    extractedDetails: {
      location: null,
      attendees: [],
      platform: null,
    },
  };
}

/**
 * Normalize a time string to HH:MM format
 * Handles various malformed inputs from LLM
 */
function normalizeTimeString(time: string): string | null {
  const trimmed = time.trim();

  // Try to match HH:MM or H:MM patterns
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);

  // Validate ranges
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  // Zero-pad hour
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

/**
 * Normalize a date string to YYYY-MM-DD format
 * Validates the date is valid
 */
function normalizeDateString(date: string): string | null {
  const trimmed = date.trim();

  // Match YYYY-MM-DD pattern
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  // Basic validation
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  // Validate the date is real (e.g., not Feb 30)
  const testDate = new Date(year, month - 1, day);
  if (
    testDate.getFullYear() !== year ||
    testDate.getMonth() !== month - 1 ||
    testDate.getDate() !== day
  ) {
    return null;
  }

  return trimmed;
}

/**
 * Convert a proposed time to a Date object for calendar checks
 * Handles timezone considerations and validates input
 *
 * @param proposedTime - The proposed time from classification
 * @param defaultDurationMinutes - Default meeting duration if end time is invalid/missing
 * @returns Object with start and end Date objects
 * @throws Error if the start date/time is invalid
 */
export function proposedTimeToDate(
  proposedTime: ProposedTime,
  defaultDurationMinutes: number = 30
): { start: Date; end: Date } {
  // Normalize and validate date
  const normalizedDate = normalizeDateString(proposedTime.date);
  if (!normalizedDate) {
    throw new Error(
      `Invalid date format: "${proposedTime.date}". Expected YYYY-MM-DD format.`
    );
  }

  // Normalize and validate start time
  const normalizedStartTime = normalizeTimeString(proposedTime.startTime);
  if (!normalizedStartTime) {
    throw new Error(
      `Invalid start time format: "${proposedTime.startTime}". Expected HH:MM format.`
    );
  }

  // Construct start date in ISO format
  const startDateTime = new Date(`${normalizedDate}T${normalizedStartTime}:00`);

  // Validate start date is valid
  if (isNaN(startDateTime.getTime())) {
    throw new Error(
      `Failed to parse start date/time: date="${proposedTime.date}", startTime="${proposedTime.startTime}"`
    );
  }

  // Handle end time
  let endDateTime: Date;
  if (proposedTime.endTime) {
    const normalizedEndTime = normalizeTimeString(proposedTime.endTime);

    if (normalizedEndTime) {
      const parsedEndDateTime = new Date(`${normalizedDate}T${normalizedEndTime}:00`);

      // If end time is valid and after start, use it; otherwise fall back to default duration
      if (!isNaN(parsedEndDateTime.getTime()) && parsedEndDateTime > startDateTime) {
        endDateTime = parsedEndDateTime;
      } else {
        console.warn(
          `[MeetingDetector] Invalid end time "${proposedTime.endTime}", using default duration`
        );
        endDateTime = new Date(startDateTime.getTime() + defaultDurationMinutes * 60 * 1000);
      }
    } else {
      console.warn(
        `[MeetingDetector] Malformed end time "${proposedTime.endTime}", using default duration`
      );
      endDateTime = new Date(startDateTime.getTime() + defaultDurationMinutes * 60 * 1000);
    }
  } else {
    // No end time specified, use default duration
    endDateTime = new Date(startDateTime.getTime() + defaultDurationMinutes * 60 * 1000);
  }

  return { start: startDateTime, end: endDateTime };
}

/**
 * Format proposed times for human-readable display
 *
 * @param proposedTimes - Array of proposed times
 * @returns Formatted string describing the proposed times
 */
export function formatProposedTimes(proposedTimes: ProposedTime[]): string {
  if (proposedTimes.length === 0) {
    return 'No specific times proposed';
  }

  return proposedTimes
    .map((time, index) => {
      const date = new Date(`${time.date}T${time.startTime}:00`);
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      };

      let formatted = date.toLocaleString('en-US', options);

      if (time.endTime) {
        const endDate = new Date(`${time.date}T${time.endTime}:00`);
        formatted += ` - ${endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      }

      if (time.timezone) {
        formatted += ` (${time.timezone})`;
      }

      if (time.isFlexible) {
        formatted += ' [flexible]';
      }

      return `Option ${index + 1}: ${formatted}`;
    })
    .join('\n');
}

/**
 * Check if the meeting classification indicates a high-confidence meeting request
 * that should trigger calendar checking
 *
 * @param classification - The meeting classification result
 * @param confidenceThreshold - Minimum confidence to consider (default: 0.7)
 * @returns True if this should trigger calendar availability check
 */
export function shouldCheckCalendar(
  classification: MeetingClassification,
  confidenceThreshold: number = 0.7
): boolean {
  return (
    classification.isMeetingRequest &&
    classification.confidence >= confidenceThreshold &&
    classification.requiresResponse
  );
}
