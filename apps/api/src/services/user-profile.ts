import { createClerkClient } from '@clerk/backend';
import { eq } from 'drizzle-orm';
import { db, userSettings, type UserSettings, type NewUserSettings } from '../db/index.js';

// Initialize Clerk client
const clerkSecretKey = process.env.CLERK_SECRET_KEY;

if (!clerkSecretKey) {
  console.warn('[UserProfile] CLERK_SECRET_KEY not set - user profile features will be limited');
}

const clerkClient = clerkSecretKey
  ? createClerkClient({ secretKey: clerkSecretKey })
  : null;

export interface UserProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string | null;
}

export interface UserSettingsData {
  calendlyUrl: string | null;
  workingHoursStart: number;
  workingHoursEnd: number;
  timezone: string;
  calendarEnabled: boolean;
}

/**
 * Get user profile by Clerk user ID
 * This is an abstraction layer that can be swapped to use a database later
 * @param userId - Clerk user ID
 * @returns User profile or null if not found
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!clerkClient) {
    console.warn('[UserProfile] Clerk client not initialized - cannot fetch user profile');
    return null;
  }

  try {
    const user = await clerkClient.users.getUser(userId);

    // Build full name from available parts
    const firstName = user.firstName || null;
    const lastName = user.lastName || null;
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'User';

    // Get primary email
    const primaryEmail = user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId
    );

    return {
      id: user.id,
      firstName,
      lastName,
      fullName,
      email: primaryEmail?.emailAddress || null,
    };
  } catch (error) {
    console.error(`[UserProfile] Failed to fetch profile for user ${userId}:`, error);
    return null;
  }
}

/**
 * Get user's display name for email signatures
 * Falls back to "User" if no name available
 * @param userId - Clerk user ID
 * @returns Display name string
 */
export async function getUserDisplayName(userId: string): Promise<string> {
  const profile = await getUserProfile(userId);
  return profile?.fullName || 'User';
}

// ============================================================================
// User Settings (Neon Database)
// ============================================================================

/**
 * Get user settings from database
 * @param userId - Clerk user ID
 * @returns User settings or null if not found
 */
export async function getUserSettings(userId: string): Promise<UserSettingsData | null> {
  try {
    const result = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const settings = result[0];
    return {
      calendlyUrl: settings.calendlyUrl,
      workingHoursStart: settings.workingHoursStart ?? 9,
      workingHoursEnd: settings.workingHoursEnd ?? 17,
      timezone: settings.timezone ?? 'UTC',
      calendarEnabled: settings.calendarEnabled ?? false,
    };
  } catch (error) {
    console.error(`[UserProfile] Failed to fetch settings for user ${userId}:`, error);
    return null;
  }
}

/**
 * Create or update user settings
 * @param userId - Clerk user ID
 * @param settings - Partial settings to update
 * @returns Updated settings
 */
export async function upsertUserSettings(
  userId: string,
  settings: Partial<Omit<UserSettingsData, 'workingHoursStart' | 'workingHoursEnd'>> & {
    workingHoursStart?: number;
    workingHoursEnd?: number;
  }
): Promise<UserSettingsData> {
  try {
    const now = new Date();

    // Check if settings exist
    const existing = await getUserSettings(userId);

    if (existing) {
      // Update existing settings
      await db
        .update(userSettings)
        .set({
          ...settings,
          updatedAt: now,
        })
        .where(eq(userSettings.userId, userId));
    } else {
      // Insert new settings
      await db.insert(userSettings).values({
        userId,
        calendlyUrl: settings.calendlyUrl ?? null,
        workingHoursStart: settings.workingHoursStart ?? 9,
        workingHoursEnd: settings.workingHoursEnd ?? 17,
        timezone: settings.timezone ?? 'UTC',
        calendarEnabled: settings.calendarEnabled ?? false,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Return the updated settings
    const updated = await getUserSettings(userId);
    return updated ?? {
      calendlyUrl: null,
      workingHoursStart: 9,
      workingHoursEnd: 17,
      timezone: 'UTC',
      calendarEnabled: false,
    };
  } catch (error) {
    console.error(`[UserProfile] Failed to upsert settings for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Get user's Calendly URL
 * @param userId - Clerk user ID
 * @returns Calendly URL or null if not set
 */
export async function getCalendlyUrl(userId: string): Promise<string | null> {
  const settings = await getUserSettings(userId);
  return settings?.calendlyUrl ?? null;
}

/**
 * Get user's working hours
 * @param userId - Clerk user ID
 * @returns Working hours object with start and end hours
 */
export async function getWorkingHours(userId: string): Promise<{ start: number; end: number }> {
  const settings = await getUserSettings(userId);
  return {
    start: settings?.workingHoursStart ?? 9,
    end: settings?.workingHoursEnd ?? 17,
  };
}
