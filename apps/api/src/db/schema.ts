import { pgTable, text, integer, timestamp, boolean } from 'drizzle-orm/pg-core';

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
