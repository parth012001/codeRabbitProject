import OpenAI from 'openai';
import {
  composio,
  GMAIL_ACTIONS,
  type GmailWebhookPayload,
} from './composio.js';
import { getUserDisplayName } from './user-profile.js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
 */
async function generateDraftReply(email: EmailData, userName: string): Promise<string> {
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
 */
function shouldProcessEmail(email: EmailData, userId: string): boolean {
  // Skip emails sent from the user's own address
  if (email.from.includes(userId)) {
    console.log('[EmailHandler] Skipping email sent by user');
    return false;
  }

  // Skip automated/no-reply emails
  const skipPatterns = ['noreply', 'no-reply', 'donotreply', 'mailer-daemon', 'postmaster'];
  const fromLower = email.from.toLowerCase();
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

  // Check if we should process this email
  if (!shouldProcessEmail(emailData, userId)) {
    return {
      processed: false,
      message: 'Email filtered out (automated/self-sent)',
    };
  }

  // Fetch user profile for personalized signature
  console.log('[EmailHandler] Fetching user profile...');
  const userName = await getUserDisplayName(userId);
  console.log(`[EmailHandler] User name: ${userName}`);

  // Generate draft reply using AI
  console.log('[EmailHandler] Generating draft reply...');
  const draftBody = await generateDraftReply(emailData, userName);
  console.log('[EmailHandler] Generated draft body:', draftBody.substring(0, 200) + '...');

  // Extract just the email address from "Name <email>" format
  const emailMatch = emailData.from.match(/<(.+)>/);
  const recipientEmail = emailMatch ? emailMatch[1] : emailData.from;
  console.log('[EmailHandler] Recipient email:', recipientEmail);

  // Create draft in Gmail
  console.log('[EmailHandler] Creating draft in Gmail...');
  try {
    const result = await composio.tools.execute(GMAIL_ACTIONS.CREATE_DRAFT, {
      userId: userId,
      arguments: {
        recipient_email: recipientEmail,
        subject: emailData.subject.startsWith('Re:') ? emailData.subject : `Re: ${emailData.subject}`,
        body: draftBody,
        is_html: false,
        thread_id: emailData.threadId, // Keep in same thread if possible
      },
    });

    console.log('[EmailHandler] Composio result:', JSON.stringify(result, null, 2));

    const data = result.data as Record<string, unknown>;
    const draftId = (data?.draft_id || data?.id || '') as string;

    console.log(`[EmailHandler] Draft created successfully: ${draftId}`);

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
