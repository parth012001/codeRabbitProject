import { Composio } from '@composio/core';
import type {
  GmailConnectionStatus,
  GmailConnectResponse,
  CalendarConnectionStatus,
  CalendarConnectResponse,
} from '@email-assistant/types';

// Lazy-initialized Composio client and config
let composioClient: Composio | null = null;
let gmailAuthConfigId: string | null = null;
let calendarAuthConfigId: string | null = null;

/**
 * Get the Composio client and auth config IDs.
 * Lazy-initialized to avoid breaking Next.js builds or client imports.
 * Should only be called from server-only contexts (API routes, Server Components, server actions).
 */
function getComposioClient(): {
  client: Composio;
  gmailAuthConfigId: string;
  calendarAuthConfigId: string;
} {
  // Return cached instances if available
  if (composioClient && gmailAuthConfigId && calendarAuthConfigId) {
    return { client: composioClient, gmailAuthConfigId, calendarAuthConfigId };
  }

  // Validate we're in a server context
  if (typeof window !== 'undefined') {
    throw new Error('Composio client can only be used in server-side code');
  }

  const apiKey = process.env.COMPOSIO_API_KEY;
  const gmailConfig = process.env.COMPOSIO_GMAIL_AUTH_CONFIG_ID;
  const calendarConfig = process.env.COMPOSIO_GCAL_AUTH_CONFIG_ID;

  if (!apiKey) {
    throw new Error('COMPOSIO_API_KEY environment variable is required');
  }

  if (!gmailConfig) {
    throw new Error('COMPOSIO_GMAIL_AUTH_CONFIG_ID environment variable is required');
  }

  if (!calendarConfig) {
    throw new Error('COMPOSIO_GCAL_AUTH_CONFIG_ID environment variable is required');
  }

  // Initialize and cache
  composioClient = new Composio({ apiKey });
  gmailAuthConfigId = gmailConfig;
  calendarAuthConfigId = calendarConfig;

  return { client: composioClient, gmailAuthConfigId, calendarAuthConfigId };
}

// ===========================================
// Gmail Functions
// ===========================================

export async function authorizeGmail(
  userId: string,
  callbackUrl?: string
): Promise<GmailConnectResponse> {
  const { client, gmailAuthConfigId } = getComposioClient();

  const connectionRequest = await client.connectedAccounts.initiate(
    userId,
    gmailAuthConfigId,
    callbackUrl ? { callbackUrl } : undefined
  );

  if (!connectionRequest.redirectUrl) {
    throw new Error('No redirect URL received from Composio');
  }

  if (!connectionRequest.id || typeof connectionRequest.id !== 'string') {
    throw new Error('No connection ID received from Composio');
  }

  return {
    redirectUrl: connectionRequest.redirectUrl,
    connectionId: connectionRequest.id,
  };
}

export async function checkGmailConnection(
  userId: string
): Promise<GmailConnectionStatus> {
  const { client, gmailAuthConfigId } = getComposioClient();

  const connections = await client.connectedAccounts.list({
    userIds: [userId],
    authConfigIds: [gmailAuthConfigId],
  });

  const gmailConnection = connections.items?.find(
    (conn: { status?: string }) => conn.status === 'ACTIVE'
  );

  return {
    connected: !!gmailConnection,
    connectionId: gmailConnection?.id,
  };
}

// ===========================================
// Calendar Functions
// ===========================================

export async function authorizeCalendar(
  userId: string,
  callbackUrl?: string
): Promise<CalendarConnectResponse> {
  const { client, calendarAuthConfigId } = getComposioClient();

  // Check if already connected
  const existing = await checkCalendarConnection(userId);
  if (existing.connected && existing.connectionId) {
    return {
      connectionId: existing.connectionId,
      alreadyConnected: true,
    };
  }

  const connectionRequest = await client.connectedAccounts.initiate(
    userId,
    calendarAuthConfigId,
    callbackUrl ? { callbackUrl } : undefined
  );

  if (!connectionRequest.redirectUrl) {
    throw new Error('No redirect URL received from Composio');
  }

  if (!connectionRequest.id || typeof connectionRequest.id !== 'string') {
    throw new Error('No connection ID received from Composio');
  }

  return {
    redirectUrl: connectionRequest.redirectUrl,
    connectionId: connectionRequest.id,
  };
}

export async function checkCalendarConnection(
  userId: string
): Promise<CalendarConnectionStatus> {
  const { client, calendarAuthConfigId } = getComposioClient();

  const connections = await client.connectedAccounts.list({
    userIds: [userId],
    authConfigIds: [calendarAuthConfigId],
  });

  const calendarConnection = connections.items?.find(
    (conn: { status?: string }) => conn.status === 'ACTIVE'
  );

  return {
    connected: !!calendarConnection,
    connectionId: calendarConnection?.id,
  };
}
