import { Composio } from '@composio/core';
import { MastraProvider } from '@composio/mastra';

// Validate required environment variables
const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;
const GMAIL_AUTH_CONFIG_ID = process.env.COMPOSIO_GMAIL_AUTH_CONFIG_ID;

if (!COMPOSIO_API_KEY) {
  throw new Error('COMPOSIO_API_KEY environment variable is required');
}

if (!GMAIL_AUTH_CONFIG_ID) {
  throw new Error('COMPOSIO_GMAIL_AUTH_CONFIG_ID environment variable is required');
}

// Initialize Composio with Mastra provider and toolkit versions
const composio = new Composio({
  apiKey: COMPOSIO_API_KEY,
  provider: new MastraProvider(),
  toolkitVersions: {
    gmail: '20251027_00',
  },
});

export { composio, GMAIL_AUTH_CONFIG_ID };

/**
 * Get Gmail tools for a specific user
 * @param userId - The user's unique identifier
 * @returns Gmail tools configured for the user
 */
export async function getGmailTools(userId: string) {
  try {
    const tools = await composio.tools.get(userId, {
      toolkits: ['GMAIL'],
    });
    return tools;
  } catch (error) {
    console.error(`Failed to get Gmail tools for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Authorize Gmail for a user - returns redirect URL for OAuth
 * Uses the configured auth config ID for Gmail
 * @param userId - The user's unique identifier
 * @returns Connection request with redirect URL
 */
export async function authorizeGmail(userId: string) {
  try {
    const connectionRequest = await composio.connectedAccounts.initiate(
      userId,
      GMAIL_AUTH_CONFIG_ID
    );

    return {
      redirectUrl: connectionRequest.redirectUrl,
      connectionId: connectionRequest.id,
      waitForConnection: () => connectionRequest.waitForConnection(),
    };
  } catch (error) {
    console.error(`Failed to authorize Gmail for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Check if user has Gmail connected
 * @param userId - The user's unique identifier
 * @returns Connection status with connected flag and optional connectionId
 * @throws Error if the API call fails
 */
export async function checkGmailConnection(
  userId: string
): Promise<{ connected: boolean; connectionId?: string }> {
  try {
    const connections = await composio.connectedAccounts.list({
      userIds: [userId],
      authConfigIds: [GMAIL_AUTH_CONFIG_ID],
    });

    const gmailConnection = connections.items?.find(
      (conn: { status?: string }) => conn.status === 'ACTIVE'
    );

    return {
      connected: !!gmailConnection,
      connectionId: gmailConnection?.id,
    };
  } catch (error) {
    console.error(`Failed to check Gmail connection for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Execute a Gmail tool action
 * @param userId - The user's unique identifier
 * @param toolName - The name of the tool to execute
 * @param params - Parameters for the tool
 * @returns Tool execution result
 */
export async function executeGmailTool(
  userId: string,
  toolName: string,
  params: Record<string, unknown>
) {
  try {
    const result = await composio.tools.execute(toolName, {
      userId,
      arguments: params,
    });
    return result;
  } catch (error) {
    console.error(`Failed to execute Gmail tool ${toolName} for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Verified Gmail actions from Composio documentation
 * Only includes actions confirmed to exist in Composio's Gmail toolkit
 */
export const GMAIL_ACTIONS = {
  FETCH_EMAILS: 'GMAIL_FETCH_EMAILS',
  SEND_EMAIL: 'GMAIL_SEND_EMAIL',
  CREATE_DRAFT: 'GMAIL_CREATE_EMAIL_DRAFT',
  REPLY_TO_THREAD: 'GMAIL_REPLY_TO_THREAD',
} as const;

export type GmailAction = (typeof GMAIL_ACTIONS)[keyof typeof GMAIL_ACTIONS];
