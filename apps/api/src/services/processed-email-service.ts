import { eq, and, desc } from 'drizzle-orm';
import { db, processedEmails, type NewProcessedEmail, type ProcessedEmail } from '../db/index.js';

/**
 * Availability status enum for type safety
 */
export type AvailabilityStatus = 'available' | 'busy' | 'unknown';

/**
 * Input type for saving a processed email
 */
export interface SaveProcessedEmailInput {
  messageId: string;
  threadId?: string;
  userId: string;
  from: string;
  subject?: string;
  snippet?: string;
  isMeetingRequest: boolean;
  availabilityStatus: AvailabilityStatus;
  draftId?: string;
  draftBody?: string;
}

/**
 * Check if an email has already been processed (for deduplication)
 * @param userId - Clerk user ID
 * @param messageId - Gmail message ID
 * @returns true if email was already processed
 */
export async function isEmailAlreadyProcessed(userId: string, messageId: string): Promise<boolean> {
  try {
    const existing = await db
      .select({ id: processedEmails.id })
      .from(processedEmails)
      .where(and(eq(processedEmails.userId, userId), eq(processedEmails.messageId, messageId)))
      .limit(1);

    return existing.length > 0;
  } catch (error) {
    console.error('[ProcessedEmailService] Error checking if email processed:', error);
    // On error, return false to allow processing (fail open for functionality)
    return false;
  }
}

/**
 * Save a processed email to the database
 * @param input - Email data to save
 * @returns The saved email record or null on error
 */
export async function saveProcessedEmail(input: SaveProcessedEmailInput): Promise<ProcessedEmail | null> {
  try {
    const newEmail: NewProcessedEmail = {
      messageId: input.messageId,
      threadId: input.threadId ?? null,
      userId: input.userId,
      from: input.from,
      subject: input.subject ?? null,
      snippet: input.snippet ?? null,
      isMeetingRequest: input.isMeetingRequest,
      availabilityStatus: input.availabilityStatus,
      draftId: input.draftId ?? null,
      draftBody: input.draftBody ?? null,
    };

    const [saved] = await db.insert(processedEmails).values(newEmail).returning();

    console.log(`[ProcessedEmailService] Saved processed email: ${saved.id}`);
    return saved;
  } catch (error) {
    console.error('[ProcessedEmailService] Error saving processed email:', error);
    // Return null on error - don't crash the webhook
    return null;
  }
}

/**
 * Get recent processed emails for a user (for brief section)
 * @param userId - Clerk user ID
 * @param limit - Maximum number of emails to return (default: 10)
 * @returns List of processed emails, most recent first
 */
export async function getRecentProcessedEmails(
  userId: string,
  limit: number = 10
): Promise<ProcessedEmail[]> {
  try {
    const emails = await db
      .select()
      .from(processedEmails)
      .where(eq(processedEmails.userId, userId))
      .orderBy(desc(processedEmails.processedAt))
      .limit(limit);

    return emails;
  } catch (error) {
    console.error('[ProcessedEmailService] Error fetching recent emails:', error);
    return [];
  }
}

/**
 * Get recent meeting emails for a user
 * @param userId - Clerk user ID
 * @param limit - Maximum number of emails to return (default: 10)
 * @returns List of meeting emails, most recent first
 */
export async function getRecentMeetingEmails(
  userId: string,
  limit: number = 10
): Promise<ProcessedEmail[]> {
  try {
    const emails = await db
      .select()
      .from(processedEmails)
      .where(and(eq(processedEmails.userId, userId), eq(processedEmails.isMeetingRequest, true)))
      .orderBy(desc(processedEmails.processedAt))
      .limit(limit);

    return emails;
  } catch (error) {
    console.error('[ProcessedEmailService] Error fetching meeting emails:', error);
    return [];
  }
}
