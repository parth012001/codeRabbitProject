import { Composio } from '@composio/core';
import { MastraProvider } from '@composio/mastra';

// Type definitions for Composio responses
interface ComposioConnection {
  id: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'FAILED';
  userId?: string;
  authConfigId?: string;
  createdAt?: string;
}

interface ComposioToolExecutionResult {
  data: Record<string, unknown>;
  error: string | null;
  successful: boolean;
  logId?: string;
}

// Validate required environment variables
const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;
const GMAIL_AUTH_CONFIG_ID = process.env.COMPOSIO_GMAIL_AUTH_CONFIG_ID;
const GCAL_AUTH_CONFIG_ID = process.env.COMPOSIO_GCAL_AUTH_CONFIG_ID;

if (!COMPOSIO_API_KEY) {
  throw new Error('COMPOSIO_API_KEY environment variable is required');
}

if (!GMAIL_AUTH_CONFIG_ID) {
  throw new Error('COMPOSIO_GMAIL_AUTH_CONFIG_ID environment variable is required');
}

if (!GCAL_AUTH_CONFIG_ID) {
  throw new Error('COMPOSIO_GCAL_AUTH_CONFIG_ID environment variable is required');
}

// After validation, we know these are defined
const validApiKey: string = COMPOSIO_API_KEY;
const validGmailAuthConfigId: string = GMAIL_AUTH_CONFIG_ID;
const validGcalAuthConfigId: string = GCAL_AUTH_CONFIG_ID;

// Initialize Composio with Mastra provider and toolkit versions
// Available versions can be queried via: curl https://backend.composio.dev/api/v3/toolkits/{toolkit}
const composio = new Composio({
  apiKey: validApiKey,
  provider: new MastraProvider(),
  toolkitVersions: {
    gmail: '20251027_00',
    googlecalendar: '20251222_01', // Latest version as of Dec 2025
  },
});

export {
  composio,
  validGmailAuthConfigId as GMAIL_AUTH_CONFIG_ID,
  validGcalAuthConfigId as GCAL_AUTH_CONFIG_ID,
};

// Helper to create anonymized user identifier for logging
function anonymizeUserId(userId: string): string {
  if (userId.length <= 8) {
    return `user_${userId.substring(0, 4)}***`;
  }
  return `user_${userId.substring(0, 4)}...${userId.substring(userId.length - 4)}`;
}

/**
 * Runtime type guard to validate Composio connection items
 * Ensures the response has the expected structure before using it
 */
function isValidConnectionArray(items: unknown): items is ComposioConnection[] {
  if (!Array.isArray(items)) {
    return false;
  }
  return items.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      typeof item.id === 'string' &&
      'status' in item &&
      typeof item.status === 'string'
  );
}

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
    console.error(`Failed to get Gmail tools for ${anonymizeUserId(userId)}:`, error);
    throw error;
  }
}

/**
 * Authorize Gmail for a user - returns redirect URL for OAuth
 * Uses the configured auth config ID for Gmail
 * If user already has an active connection, returns that instead of creating new one
 * @param userId - The user's unique identifier
 * @param callbackUrl - URL to redirect to after OAuth completion
 * @returns Connection request with redirect URL, or existing connection info
 */
export async function authorizeGmail(
  userId: string,
  callbackUrl?: string
): Promise<{ redirectUrl?: string; connectionId: string; alreadyConnected?: boolean }> {
  try {
    // First check if user already has an active connection
    const existingConnection = await checkGmailConnection(userId);
    if (existingConnection.connected && existingConnection.connectionId) {
      console.log(`User ${anonymizeUserId(userId)} already has active Gmail connection: ${existingConnection.connectionId}`);
      return {
        connectionId: existingConnection.connectionId,
        alreadyConnected: true,
      };
    }

    // No active connection, initiate new OAuth flow
    const connectionRequest = await composio.connectedAccounts.initiate(
      userId,
      validGmailAuthConfigId,
      callbackUrl ? { callbackUrl } : undefined
    );

    if (!connectionRequest.redirectUrl) {
      throw new Error('No redirect URL received from Composio');
    }

    return {
      redirectUrl: connectionRequest.redirectUrl,
      connectionId: connectionRequest.id,
    };
  } catch (error) {
    console.error(`Failed to authorize Gmail for ${anonymizeUserId(userId)}:`, error);
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
      authConfigIds: [validGmailAuthConfigId],
    });

    // Validate the response structure at runtime
    const rawItems = connections.items;
    if (!isValidConnectionArray(rawItems)) {
      console.error(
        `[Composio] Unexpected response structure for ${anonymizeUserId(userId)}:`,
        JSON.stringify(rawItems)
      );
      return { connected: false };
    }

    console.log(
      `[Composio] Connections for ${anonymizeUserId(userId)}:`,
      JSON.stringify(rawItems.map((c) => ({ id: c.id, status: c.status })))
    );

    const gmailConnection = rawItems.find((conn) => conn.status === 'ACTIVE');

    if (gmailConnection) {
      console.log(`[Composio] Found active connection: ${gmailConnection.id}`);
    } else {
      console.log(`[Composio] No active connection found. Total connections: ${rawItems.length}`);
    }

    return {
      connected: !!gmailConnection,
      connectionId: gmailConnection?.id,
    };
  } catch (error) {
    console.error(`Failed to check Gmail connection for ${anonymizeUserId(userId)}:`, error);
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
): Promise<ComposioToolExecutionResult> {
  try {
    const result = await composio.tools.execute(toolName, {
      userId,
      arguments: params,
    });
    return result;
  } catch (error) {
    console.error(`Failed to execute Gmail tool ${toolName} for ${anonymizeUserId(userId)}:`, error);
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

/**
 * Gmail trigger name for new email events
 */
export const GMAIL_TRIGGER = 'GMAIL_NEW_GMAIL_MESSAGE';

/**
 * Interface for Gmail message from webhook payload
 */
export interface GmailWebhookPayload {
  type: string;
  triggerId?: string;
  triggerName?: string;
  userId?: string;
  data?: {
    messageId?: string;
    threadId?: string;
    from?: string;
    to?: string;
    subject?: string;
    snippet?: string;
    body?: string;
    date?: string;
    labelIds?: string[];
  };
  payload?: Record<string, unknown>;
}

/**
 * Create a Gmail trigger for a user to receive new email notifications
 * @param userId - The user's unique identifier
 * @returns Trigger creation result
 */
export async function createGmailTrigger(
  userId: string
): Promise<{ success: boolean; triggerId?: string; error?: string }> {
  try {
    // First check if user has Gmail connected
    const connectionStatus = await checkGmailConnection(userId);
    if (!connectionStatus.connected) {
      return {
        success: false,
        error: 'Gmail not connected. Please connect Gmail first.',
      };
    }

    console.log(`[Composio] Creating Gmail trigger for ${anonymizeUserId(userId)}`);

    const triggerResult = await composio.triggers.create(userId, GMAIL_TRIGGER, {
      triggerConfig: {},
    });

    console.log(`[Composio] Trigger created:`, JSON.stringify(triggerResult, null, 2));

    return {
      success: true,
      triggerId: triggerResult.triggerId || String(triggerResult),
    };
  } catch (error) {
    console.error(`Failed to create Gmail trigger for ${anonymizeUserId(userId)}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create trigger',
    };
  }
}

/**
 * List active triggers for a user
 * Note: This is a placeholder - Composio SDK may not expose list method directly
 * @param userId - The user's unique identifier
 * @returns List of active triggers
 */
export async function listUserTriggers(
  userId: string
): Promise<{ triggers: Array<{ id: string; name: string; status: string }>; error?: string }> {
  try {
    // The Composio SDK may not expose a list method directly
    // For now, return empty and log for debugging
    console.log(`[Composio] Listing triggers for ${anonymizeUserId(userId)}`);

    // Composio triggers are managed server-side, we may need to use the REST API directly
    // or check the Composio dashboard for active triggers
    return {
      triggers: [],
    };
  } catch (error) {
    console.error(`Failed to list triggers for ${anonymizeUserId(userId)}:`, error);
    return {
      triggers: [],
      error: error instanceof Error ? error.message : 'Failed to list triggers',
    };
  }
}

// ============================================================================
// Google Calendar Integration
// ============================================================================

/**
 * Google Calendar actions from Composio
 * Reference: https://mcp.composio.dev/googlecalendar
 *
 * IMPORTANT: These slugs must match exactly what Composio API expects.
 * Verified action names from Composio MCP documentation (2024-2025).
 */
/**
 * Google Calendar actions - VERIFIED from actual Composio tools list (20 tools available)
 * Full list: GOOGLECALENDAR_ACL_PATCH, CALENDAR_LIST_INSERT, CALENDAR_LIST_UPDATE,
 * CALENDARS_DELETE, CALENDARS_UPDATE, CLEAR_CALENDAR, CREATE_EVENT, DELETE_EVENT,
 * DUPLICATE_CALENDAR, EVENTS_INSTANCES, EVENTS_LIST, EVENTS_MOVE, EVENTS_WATCH,
 * FIND_EVENT, FIND_FREE_SLOTS, FREE_BUSY_QUERY, GET_CALENDAR, GET_CURRENT_DATE_TIME,
 * LIST_ACL_RULES, LIST_CALENDARS
 */
export const CALENDAR_ACTIONS = {
  // Event operations
  LIST_EVENTS: 'GOOGLECALENDAR_EVENTS_LIST',
  CREATE_EVENT: 'GOOGLECALENDAR_CREATE_EVENT',
  DELETE_EVENT: 'GOOGLECALENDAR_DELETE_EVENT',
  FIND_EVENT: 'GOOGLECALENDAR_FIND_EVENT',
  EVENTS_MOVE: 'GOOGLECALENDAR_EVENTS_MOVE',
  EVENTS_INSTANCES: 'GOOGLECALENDAR_EVENTS_INSTANCES',
  EVENTS_WATCH: 'GOOGLECALENDAR_EVENTS_WATCH',

  // Availability checking
  FIND_FREE_SLOTS: 'GOOGLECALENDAR_FIND_FREE_SLOTS',
  FREEBUSY_QUERY: 'GOOGLECALENDAR_FREE_BUSY_QUERY',

  // Calendar operations
  GET_CALENDAR: 'GOOGLECALENDAR_GET_CALENDAR',
  LIST_CALENDARS: 'GOOGLECALENDAR_LIST_CALENDARS',
  CALENDARS_UPDATE: 'GOOGLECALENDAR_CALENDARS_UPDATE',
  CALENDARS_DELETE: 'GOOGLECALENDAR_CALENDARS_DELETE',
  CLEAR_CALENDAR: 'GOOGLECALENDAR_CLEAR_CALENDAR',
  DUPLICATE_CALENDAR: 'GOOGLECALENDAR_DUPLICATE_CALENDAR',

  // Utility
  GET_CURRENT_DATE_TIME: 'GOOGLECALENDAR_GET_CURRENT_DATE_TIME',
} as const;

export type CalendarAction = (typeof CALENDAR_ACTIONS)[keyof typeof CALENDAR_ACTIONS];

/**
 * Authorize Google Calendar for a user - returns redirect URL for OAuth
 * Uses the configured auth config ID for Google Calendar
 * If user already has an active connection, returns that instead of creating new one
 * @param userId - The user's unique identifier
 * @param callbackUrl - URL to redirect to after OAuth completion
 * @returns Connection request with redirect URL, or existing connection info
 */
export async function authorizeGoogleCalendar(
  userId: string,
  callbackUrl?: string
): Promise<{ redirectUrl?: string; connectionId: string; alreadyConnected?: boolean }> {
  try {
    // First check if user already has an active connection
    const existingConnection = await checkCalendarConnection(userId);
    if (existingConnection.connected && existingConnection.connectionId) {
      console.log(
        `User ${anonymizeUserId(userId)} already has active Calendar connection: ${existingConnection.connectionId}`
      );
      return {
        connectionId: existingConnection.connectionId,
        alreadyConnected: true,
      };
    }

    // No active connection, initiate new OAuth flow
    const connectionRequest = await composio.connectedAccounts.initiate(
      userId,
      validGcalAuthConfigId,
      callbackUrl ? { callbackUrl } : undefined
    );

    if (!connectionRequest.redirectUrl) {
      throw new Error('No redirect URL received from Composio for Calendar');
    }

    return {
      redirectUrl: connectionRequest.redirectUrl,
      connectionId: connectionRequest.id,
    };
  } catch (error) {
    console.error(`Failed to authorize Google Calendar for ${anonymizeUserId(userId)}:`, error);
    throw error;
  }
}

/**
 * Check if user has Google Calendar connected
 * @param userId - The user's unique identifier
 * @returns Connection status with connected flag and optional connectionId
 * @throws Error if the API call fails
 */
export async function checkCalendarConnection(
  userId: string
): Promise<{ connected: boolean; connectionId?: string }> {
  try {
    const connections = await composio.connectedAccounts.list({
      userIds: [userId],
      authConfigIds: [validGcalAuthConfigId],
    });

    // Validate the response structure at runtime
    const rawItems = connections.items;
    if (!isValidConnectionArray(rawItems)) {
      console.error(
        `[Composio] Unexpected Calendar response structure for ${anonymizeUserId(userId)}:`,
        JSON.stringify(rawItems)
      );
      return { connected: false };
    }

    console.log(
      `[Composio] Calendar connections for ${anonymizeUserId(userId)}:`,
      JSON.stringify(rawItems.map((c) => ({ id: c.id, status: c.status })))
    );

    const calendarConnection = rawItems.find((conn) => conn.status === 'ACTIVE');

    if (calendarConnection) {
      console.log(`[Composio] Found active Calendar connection: ${calendarConnection.id}`);
    } else {
      console.log(`[Composio] No active Calendar connection found. Total: ${rawItems.length}`);
    }

    return {
      connected: !!calendarConnection,
      connectionId: calendarConnection?.id,
    };
  } catch (error) {
    console.error(`Failed to check Calendar connection for ${anonymizeUserId(userId)}:`, error);
    throw error;
  }
}

/**
 * Get Google Calendar tools for a specific user
 * @param userId - The user's unique identifier
 * @returns Calendar tools configured for the user
 */
export async function getCalendarTools(userId: string) {
  try {
    const tools = await composio.tools.get(userId, {
      toolkits: ['GOOGLECALENDAR'],
    });
    return tools;
  } catch (error) {
    console.error(`Failed to get Calendar tools for ${anonymizeUserId(userId)}:`, error);
    throw error;
  }
}

/**
 * Execute a Google Calendar tool action
 * @param userId - The user's unique identifier
 * @param toolName - The name of the tool to execute
 * @param params - Parameters for the tool
 * @returns Tool execution result
 */
export async function executeCalendarTool(
  userId: string,
  toolName: string,
  params: Record<string, unknown>
): Promise<ComposioToolExecutionResult> {
  try {
    const result = await composio.tools.execute(toolName, {
      userId,
      arguments: params,
    });
    return result;
  } catch (error) {
    console.error(`Failed to execute Calendar tool ${toolName} for ${anonymizeUserId(userId)}:`, error);
    throw error;
  }
}
