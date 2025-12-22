import { pgTable, text, integer, timestamp, boolean, uuid, index } from 'drizzle-orm/pg-core';

/**
 * User Settings Table
 * Stores user-specific settings like Calendly URL and working hours
 */
export const userSettings = pgTable('user_settings', {
  // Clerk user ID as primary key
  userId: text('user_id').primaryKey(),

  // Calendly URL for fallback when user is unavailable
  calendlyUrl: text('calendly_url'),

  // Working hours configuration
  workingHoursStart: integer('working_hours_start').default(9), // 9 AM
  workingHoursEnd: integer('working_hours_end').default(17), // 5 PM

  // Timezone for the user (e.g., 'America/New_York', 'UTC')
  timezone: text('timezone').default('UTC'),

  // Whether calendar integration is enabled for meeting detection
  calendarEnabled: boolean('calendar_enabled').default(false),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Type inference helpers
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;

/**
 * Processed Emails Table
 * Stores emails that have been processed by the webhook handler
 * Used for the brief section and to prevent duplicate processing
 */
export const processedEmails = pgTable(
  'processed_emails',
  {
    // Auto-generated UUID primary key
    id: uuid('id').defaultRandom().primaryKey(),

    // Gmail message identifiers
    messageId: text('message_id').notNull(),
    threadId: text('thread_id'),

    // User who received this email (Clerk user ID)
    userId: text('user_id').notNull(),

    // Email metadata for display
    from: text('from').notNull(),
    subject: text('subject'),
    snippet: text('snippet'),

    // Meeting classification
    isMeetingRequest: boolean('is_meeting_request').default(false).notNull(),

    // Calendar availability at time of processing
    // 'available' | 'busy' | 'unknown' (unknown = calendar not connected or check failed)
    availabilityStatus: text('availability_status').default('unknown').notNull(),

    // Generated draft information
    draftId: text('draft_id'),
    draftBody: text('draft_body'),

    // When this email was processed
    processedAt: timestamp('processed_at').defaultNow().notNull(),
  },
  (table) => [
    // Index for querying emails by user (for brief section)
    index('processed_emails_user_id_idx').on(table.userId),
    // Index for deduplication check (messageId + userId)
    index('processed_emails_message_user_idx').on(table.messageId, table.userId),
    // Index for ordering by processed time
    index('processed_emails_processed_at_idx').on(table.processedAt),
  ]
);

// Type inference helpers for processed emails
export type ProcessedEmail = typeof processedEmails.$inferSelect;
export type NewProcessedEmail = typeof processedEmails.$inferInsert;
