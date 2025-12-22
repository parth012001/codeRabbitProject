import OpenAI from 'openai';
import {
  composio,
  GMAIL_ACTIONS,
  checkCalendarConnection,
  type GmailWebhookPayload,
} from './composio.js';
import { getUserProfile, getUserSettings, getCalendlyUrl } from './user-profile.js';
import {
  detectMeetingRequest,
  shouldCheckCalendar,
  proposedTimeToDate,
  formatProposedTimes,
  type MeetingClassification,
} from './meeting-detector.js';
import { checkAvailability, getAvailableSlots, createCalendarEvent } from './calendar-service.js';
import {
  isEmailAlreadyProcessed,
  saveProcessedEmail,
  type AvailabilityStatus,
} from './processed-email-service.js';
import { detectUrgency } from './urgency-detector.js';

// Validate required environment variable
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required for email draft generation');
}

// Initialize OpenAI client with validated key
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

interface WebhookResult {
  processed: boolean;
  draftId?: string;
  message: string;
}

interface EmailData {
  messageId: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
}

/**
 * Generate a draft reply using OpenAI
 * @param email - The email data to reply to
 * @param userName - The user's display name for the signature
 * @throws Error if OpenAI client is not available
 */
async function generateDraftReply(email: EmailData, userName: string): Promise<string> {
  // Guard: ensure OpenAI client is available (should always be true after module init validation)
  if (!openai) {
    throw new Error('[EmailHandler] OpenAI client not initialized - OPENAI_API_KEY may be missing');
  }

  const prompt = `You are a helpful email assistant. Generate a professional and friendly draft reply to the following email.

From: ${email.from}
Subject: ${email.subject}
Content: ${email.body || email.snippet}

Requirements:
- Be polite and professional
- Address the main points of the email
- Keep the response concise but complete
- Don't include a subject line, just the body
- Sign off with "Best regards," followed by the sender's name: ${userName}
- Do NOT use placeholders like [Your Name], [Your Position], or [Your Contact Information]

Draft reply:`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful email assistant that generates professional draft replies.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || 'Thank you for your email. I will get back to you shortly.';
  } catch (error) {
    console.error('[EmailHandler] Failed to generate draft:', error);
    return 'Thank you for your email. I will get back to you shortly.';
  }
}

/**
 * Generate a meeting-specific draft reply
 * @param email - The email data
 * @param userName - The user's display name
 * @param classification - Meeting classification result
 * @param isAvailable - Whether the user is available at the proposed time
 * @param calendlyUrl - User's Calendly URL for fallback
 * @param availableSlots - Alternative available time slots if not available
 */
async function generateMeetingDraftReply(
  email: EmailData,
  userName: string,
  classification: MeetingClassification,
  isAvailable: boolean,
  calendlyUrl: string | null,
  availableSlots: string[]
): Promise<string> {
  const proposedTimesText = formatProposedTimes(classification.proposedTimes);

  let contextInfo = '';

  if (isAvailable && classification.proposedTimes.length > 0) {
    contextInfo = `
AVAILABILITY STATUS: The user IS AVAILABLE at the proposed time(s).
Proposed time(s): ${proposedTimesText}

Generate a reply that:
- Confirms availability for the proposed meeting time
- Expresses enthusiasm about meeting
- Asks for any additional details needed (location, video call link, agenda, etc.)`;
  } else if (!isAvailable && calendlyUrl) {
    contextInfo = `
AVAILABILITY STATUS: The user is NOT AVAILABLE at the proposed time(s).
Proposed time(s): ${proposedTimesText}
User's Calendly link: ${calendlyUrl}

Generate a reply that:
- Politely declines the specific proposed time(s) due to a scheduling conflict
- Provides the Calendly link for them to find a suitable time
- Expresses enthusiasm about finding a time that works`;
  } else if (!isAvailable && availableSlots.length > 0) {
    contextInfo = `
AVAILABILITY STATUS: The user is NOT AVAILABLE at the proposed time(s).
Proposed time(s): ${proposedTimesText}
Alternative available slots: ${availableSlots.join(', ')}

Generate a reply that:
- Politely declines the specific proposed time(s) due to a scheduling conflict
- Suggests the alternative available time slots
- Asks them to confirm which time works best`;
  } else {
    contextInfo = `
AVAILABILITY STATUS: Unable to check calendar availability.
Proposed time(s): ${proposedTimesText}

Generate a reply that:
- Acknowledges the meeting request
- Says you'll check your calendar and get back to them shortly
- Asks for any additional details about the meeting purpose`;
  }

  const prompt = `You are a helpful email assistant. Generate a professional and friendly draft reply to this MEETING REQUEST email.

From: ${email.from}
Subject: ${email.subject}
Content: ${email.body || email.snippet}

Meeting Details Detected:
- Meeting Type: ${classification.meetingType}
- Purpose: ${classification.meetingPurpose || 'Not specified'}
- Urgent: ${classification.isUrgent ? 'Yes' : 'No'}
${contextInfo}

Requirements:
- Be polite and professional
- Keep the response concise
- Don't include a subject line, just the body
- Sign off with "Best regards," followed by: ${userName}
- Do NOT use placeholders like [Your Name], [Your Position], etc.

Draft reply:`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful email assistant that generates professional meeting response drafts.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || 'Thank you for the meeting request. I will check my availability and get back to you shortly.';
  } catch (error) {
    console.error('[EmailHandler] Failed to generate meeting draft:', error);
    return 'Thank you for the meeting request. I will check my availability and get back to you shortly.';
  }
}

/**
 * Extract email data from webhook payload
 */
function extractEmailData(payload: GmailWebhookPayload): EmailData | null {
  // Handle different payload structures from Composio
  // Cast to Record to allow flexible property access
  const rawData = (payload.data || payload.payload) as Record<string, unknown> | undefined;

  if (!rawData) {
    console.log('[EmailHandler] No data in payload');
    return null;
  }

  // Extract fields - Composio uses: sender, message_text, thread_id, etc.
  const messageId = String(rawData['message_id'] || rawData['messageId'] || rawData['id'] || '');
  const threadId = String(rawData['thread_id'] || rawData['threadId'] || '');
  const from = String(rawData['sender'] || rawData['from'] || '');
  const to = String(rawData['to'] || rawData['recipient'] || '');
  const subject = String(rawData['subject'] || '');

  // Composio sends message_text for the body, or check preview.body
  const preview = rawData['preview'] as Record<string, unknown> | undefined;
  const snippet = String(rawData['snippet'] || preview?.['body'] || '');
  const body = String(rawData['message_text'] || rawData['body'] || snippet);

  if (!from || !messageId) {
    console.log('[EmailHandler] Missing required email fields. from:', from, 'messageId:', messageId);
    return null;
  }

  return {
    messageId,
    threadId,
    from,
    to,
    subject,
    snippet,
    body,
  };
}

/**
 * Check if this email should be processed (not sent by us, etc.)
 * @param email - The email data to check
 * @param userEmail - The user's email address to check against (for self-sent detection)
 */
function shouldProcessEmail(email: EmailData, userEmail: string | null): boolean {
  const fromLower = email.from.toLowerCase();

  // Skip emails sent from the user's own address
  if (userEmail && fromLower.includes(userEmail.toLowerCase())) {
    console.log('[EmailHandler] Skipping email sent by user');
    return false;
  }

  // Skip automated/no-reply emails
  const skipPatterns = ['noreply', 'no-reply', 'donotreply', 'mailer-daemon', 'postmaster'];
  if (skipPatterns.some((pattern) => fromLower.includes(pattern))) {
    console.log('[EmailHandler] Skipping automated email');
    return false;
  }

  return true;
}

/**
 * Main handler for email webhook events
 */
export async function handleEmailWebhook(payload: GmailWebhookPayload): Promise<WebhookResult> {
  console.log('[EmailHandler] Processing webhook payload');

  // Check if this is a Gmail new message event
  const eventType = payload.type || payload.triggerName || '';
  if (!eventType.toLowerCase().includes('gmail') && !eventType.toLowerCase().includes('email')) {
    console.log(`[EmailHandler] Ignoring non-email event: ${eventType}`);
    return {
      processed: false,
      message: `Ignored non-email event type: ${eventType}`,
    };
  }

  // Extract userId from the payload - Composio sends it inside data as user_id
  const rawData = payload.data as Record<string, unknown> | undefined;
  const userId = payload.userId || (rawData?.['user_id'] as string);
  if (!userId) {
    console.log('[EmailHandler] No userId in payload');
    return {
      processed: false,
      message: 'No userId provided in webhook payload',
    };
  }

  // Extract email data
  const emailData = extractEmailData(payload);
  if (!emailData) {
    return {
      processed: false,
      message: 'Could not extract email data from payload',
    };
  }

  console.log(`[EmailHandler] Processing email from: ${emailData.from}, subject: ${emailData.subject}`);

  // Check for duplicate processing (fail-open: if check fails, we still process)
  const alreadyProcessed = await isEmailAlreadyProcessed(userId, emailData.messageId);
  if (alreadyProcessed) {
    console.log(`[EmailHandler] Email ${emailData.messageId} already processed, skipping`);
    return {
      processed: false,
      message: 'Email already processed',
    };
  }

  // Fetch user profile for self-sent detection and personalized signature
  console.log('[EmailHandler] Fetching user profile...');
  const userProfile = await getUserProfile(userId);
  const userName = userProfile?.fullName || 'User';
  const userEmail = userProfile?.email || null;
  console.log(`[EmailHandler] User: ${userName}, Email: ${userEmail ? userEmail.substring(0, 3) + '***' : 'unknown'}`);

  // Check if we should process this email
  if (!shouldProcessEmail(emailData, userEmail)) {
    return {
      processed: false,
      message: 'Email filtered out (automated/self-sent)',
    };
  }

  // Get user settings for calendar features
  const userSettings = await getUserSettings(userId);
  const calendarEnabled = userSettings?.calendarEnabled ?? false;

  // Detect if this is a meeting request
  console.log('[EmailHandler] Checking if email is a meeting request...');
  const meetingClassification = await detectMeetingRequest({
    from: emailData.from,
    subject: emailData.subject,
    body: emailData.body || emailData.snippet,
  });

  console.log(
    `[EmailHandler] Meeting detection: isMeeting=${meetingClassification.isMeetingRequest}, confidence=${meetingClassification.confidence}`
  );

  let draftBody: string;
  // Track availability status for persistence
  let availabilityStatus: AvailabilityStatus = 'unknown';
  // Track urgency for persistence
  // For meeting emails: use AI classification's isUrgent
  // For non-meeting emails: use regex-based detection
  let isUrgent = meetingClassification.isMeetingRequest
    ? meetingClassification.isUrgent
    : detectUrgency(emailData.subject, emailData.body || emailData.snippet);

  if (isUrgent) {
    console.log('[EmailHandler] Email flagged as URGENT');
  }

  // Track event creation params for when user is available (accessible outside meeting block)
  let shouldCreateEvent = false;
  let eventStartTime: string | null = null;
  let eventDurationMinutes: number = 30;

  // Handle meeting request emails with calendar integration
  if (shouldCheckCalendar(meetingClassification) && calendarEnabled) {
    console.log('[EmailHandler] Processing as meeting request with calendar check...');

    // Track whether we successfully checked calendar availability
    let calendarCheckSucceeded = false;
    let isAvailable = false;
    let alternativeSlots: string[] = [];

    // Wrap calendar operations in try-catch for graceful degradation
    // If calendar operations fail, we still generate a draft (just without availability info)
    try {
      // Check if calendar is connected
      const calendarConnection = await checkCalendarConnection(userId);

      if (calendarConnection.connected && meetingClassification.proposedTimes.length > 0) {
        // Check availability for the first proposed time
        const proposedTime = meetingClassification.proposedTimes[0];
        const { start, end } = proposedTimeToDate(
          proposedTime,
          meetingClassification.durationMinutes ?? 30
        );

        console.log(`[EmailHandler] Checking availability: ${start.toISOString()} to ${end.toISOString()}`);

        const availability = await checkAvailability(userId, start.toISOString(), end.toISOString());

        // Check if the availability check returned an error
        if (availability.error) {
          console.warn(`[EmailHandler] Availability check returned error: ${availability.error}`);
          // Don't set calendarCheckSucceeded - we'll fall back to generic response
        } else {
          isAvailable = availability.isAvailable;
          calendarCheckSucceeded = true;
          // Update availability status for persistence
          availabilityStatus = isAvailable ? 'available' : 'busy';

          // If available, prepare to create calendar event
          if (isAvailable) {
            shouldCreateEvent = true;
            eventStartTime = start.toISOString();
            eventDurationMinutes = meetingClassification.durationMinutes ?? 30;
          }

          // Get alternative slots if not available
          if (!isAvailable) {
            try {
              const slotsResult = await getAvailableSlots(userId, start);
              if (!slotsResult.error) {
                alternativeSlots = slotsResult.slots.slice(0, 3).map((slot) => {
                  const slotDate = new Date(slot.start);
                  return slotDate.toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  });
                });
              } else {
                console.warn(`[EmailHandler] Failed to get alternative slots: ${slotsResult.error}`);
              }
            } catch (slotsError) {
              // Non-critical: we can still respond without alternative slots
              console.warn('[EmailHandler] Error getting alternative slots:', slotsError);
            }
          }

          console.log(`[EmailHandler] Availability: ${isAvailable ? 'AVAILABLE' : 'BUSY'}`);
        }
      } else if (!calendarConnection.connected) {
        console.log('[EmailHandler] Calendar not connected');
      } else {
        console.log('[EmailHandler] No proposed times in meeting request');
      }
    } catch (calendarError) {
      // Log the error but don't crash - we'll generate a generic meeting response
      console.error('[EmailHandler] Calendar operation failed:', calendarError);
      console.log('[EmailHandler] Falling back to generic meeting response');
    }

    // Get calendly URL for fallback (outside try-catch as it's from user profile, not calendar)
    const calendlyUrl = await getCalendlyUrl(userId);

    if (calendarCheckSucceeded) {
      // Generate meeting-specific draft with availability info
      draftBody = await generateMeetingDraftReply(
        emailData,
        userName,
        meetingClassification,
        isAvailable,
        calendlyUrl,
        alternativeSlots
      );
    } else {
      // Calendar check failed or not available - generate meeting draft without availability
      console.log('[EmailHandler] Generating generic meeting response (calendar check unavailable)');
      draftBody = await generateMeetingDraftReply(
        emailData,
        userName,
        meetingClassification,
        false, // Can't confirm availability
        calendlyUrl,
        []
      );
    }
  } else {
    // Regular email - generate standard draft reply
    console.log('[EmailHandler] Generating standard draft reply...');
    draftBody = await generateDraftReply(emailData, userName);
  }

  console.log('[EmailHandler] Generated draft body:', draftBody.substring(0, 200) + '...');

  // Extract just the email address from "Name <email>" format
  const emailMatch = emailData.from.match(/<(.+)>/);
  const recipientEmail = emailMatch ? emailMatch[1] : emailData.from;
  console.log('[EmailHandler] Recipient email:', recipientEmail);

  // Create draft in Gmail (and calendar event if user is available)
  console.log('[EmailHandler] Creating draft in Gmail...');
  try {
    // Build the promises to run in parallel
    const draftPromise = composio.tools.execute(GMAIL_ACTIONS.CREATE_DRAFT, {
      userId: userId,
      arguments: {
        recipient_email: recipientEmail,
        subject: emailData.subject.startsWith('Re:') ? emailData.subject : `Re: ${emailData.subject}`,
        body: draftBody,
        is_html: false,
        thread_id: emailData.threadId, // Keep in same thread if possible
      },
    });

    // Create calendar event in parallel if user is available
    let eventPromise: Promise<{ success: boolean; eventId?: string; error?: string }> | null = null;
    if (shouldCreateEvent && eventStartTime) {
      console.log('[EmailHandler] Creating calendar event in parallel...');

      // Build event description from meeting details
      const eventDescription = [
        meetingClassification.meetingPurpose ? `Purpose: ${meetingClassification.meetingPurpose}` : '',
        meetingClassification.extractedDetails?.platform
          ? `Platform: ${meetingClassification.extractedDetails.platform}`
          : '',
        `Requested by: ${emailData.from}`,
      ]
        .filter(Boolean)
        .join('\n');

      eventPromise = createCalendarEvent(userId, {
        title: emailData.subject || 'Meeting',
        description: eventDescription,
        startTime: eventStartTime,
        durationMinutes: eventDurationMinutes,
        location: meetingClassification.extractedDetails?.location ?? undefined,
        attendees: [recipientEmail], // Add the sender as attendee
      });
    }

    // Wait for both operations to complete
    const [draftResult, eventResult] = await Promise.all([
      draftPromise,
      eventPromise ?? Promise.resolve(null),
    ]);

    console.log('[EmailHandler] Composio draft result:', JSON.stringify(draftResult, null, 2));

    const data = draftResult.data as Record<string, unknown>;
    const draftId = (data?.draft_id || data?.id || '') as string;

    console.log(`[EmailHandler] Draft created successfully: ${draftId}`);

    // Log event creation result
    if (eventResult) {
      if (eventResult.success) {
        console.log(`[EmailHandler] Calendar event created successfully: ${eventResult.eventId}`);
      } else {
        console.warn(`[EmailHandler] Calendar event creation failed: ${eventResult.error}`);
      }
    }

    // Persist the processed email for brief section and history
    // This is non-blocking - failure here shouldn't fail the webhook
    await saveProcessedEmail({
      messageId: emailData.messageId,
      threadId: emailData.threadId || undefined,
      userId,
      from: emailData.from,
      subject: emailData.subject || undefined,
      snippet: emailData.snippet || undefined,
      isMeetingRequest: meetingClassification.isMeetingRequest,
      availabilityStatus,
      isUrgent,
      draftId: draftId || undefined,
      draftBody,
    });

    return {
      processed: true,
      draftId,
      message: `Draft reply created for email from ${emailData.from}`,
    };
  } catch (error) {
    console.error('[EmailHandler] Failed to create draft:', error);
    return {
      processed: false,
      message: `Failed to create draft: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
