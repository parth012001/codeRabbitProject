import { Composio } from '@composio/core';
import type { GmailConnectionStatus, GmailConnectResponse } from '@email-assistant/types';

// Lazy-initialized Composio client and config
let composioClient: Composio | null = null;
let gmailAuthConfigId: string | null = null;

/**
 * Get the Composio client and auth config ID.
 * Lazy-initialized to avoid breaking Next.js builds or client imports.
 * Should only be called from server-only contexts (API routes, Server Components, server actions).
 */
function getComposioClient(): { client: Composio; authConfigId: string } {
  // Return cached instances if available
  if (composioClient && gmailAuthConfigId) {
    return { client: composioClient, authConfigId: gmailAuthConfigId };
  }

  // Validate we're in a server context
  if (typeof window !== 'undefined') {
    throw new Error('Composio client can only be used in server-side code');
  }

  const apiKey = process.env.COMPOSIO_API_KEY;
  const authConfigId = process.env.COMPOSIO_GMAIL_AUTH_CONFIG_ID;

  if (!apiKey) {
    throw new Error('COMPOSIO_API_KEY environment variable is required');
  }

  if (!authConfigId) {
    throw new Error('COMPOSIO_GMAIL_AUTH_CONFIG_ID environment variable is required');
  }

  // Initialize and cache
  composioClient = new Composio({ apiKey });
  gmailAuthConfigId = authConfigId;

  return { client: composioClient, authConfigId: gmailAuthConfigId };
}

export async function authorizeGmail(
  userId: string,
  callbackUrl?: string
): Promise<GmailConnectResponse> {
  const { client, authConfigId } = getComposioClient();

  const connectionRequest = await client.connectedAccounts.initiate(
    userId,
    authConfigId,
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
  const { client, authConfigId } = getComposioClient();

  const connections = await client.connectedAccounts.list({
    userIds: [userId],
    authConfigIds: [authConfigId],
  });

  const gmailConnection = connections.items?.find(
    (conn: { status?: string }) => conn.status === 'ACTIVE'
  );

  return {
    connected: !!gmailConnection,
    connectionId: gmailConnection?.id,
  };
}
