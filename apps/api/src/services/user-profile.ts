import { createClerkClient } from '@clerk/backend';

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
