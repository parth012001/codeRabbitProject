import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  composio,
  authorizeGmail,
  checkGmailConnection,
  GMAIL_ACTIONS,
} from '../../services/composio.js';

/**
 * Helper to verify Gmail connection before executing actions
 */
async function ensureGmailConnected(userId: string): Promise<{ connected: boolean; error?: string }> {
  try {
    const connectionStatus = await checkGmailConnection(userId);
    if (!connectionStatus.connected) {
      return { connected: false, error: 'Gmail not connected. Please connect Gmail first using the connect-gmail tool.' };
    }
    return { connected: true };
  } catch (error) {
    return { connected: false, error: `Failed to verify Gmail connection: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

/**
 * Tool: Connect Gmail Account
 * Initiates OAuth flow for user to connect their Gmail
 */
export const connectGmailTool = createTool({
  id: 'connect-gmail',
  description:
    'Connect a Gmail account for the user. Returns an OAuth URL that the user must visit to authorize access.',
  inputSchema: z.object({
    userId: z.string().describe('Unique identifier for the user'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    redirectUrl: z.string().optional(),
    message: z.string(),
    alreadyConnected: z.boolean().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const connectionStatus = await checkGmailConnection(context.userId);

      if (connectionStatus.connected) {
        return {
          success: true,
          message: 'Gmail is already connected for this user.',
          alreadyConnected: true,
        };
      }

      const authResult = await authorizeGmail(context.userId);

      // User already has an active connection
      if (authResult.alreadyConnected) {
        return {
          success: true,
          message: 'Gmail is already connected for this user.',
          alreadyConnected: true,
        };
      }

      if (!authResult.redirectUrl || typeof authResult.redirectUrl !== 'string') {
        return {
          success: false,
          message: 'Failed to obtain authorization URL. Please try again or check Composio configuration.',
          alreadyConnected: false,
        };
      }

      return {
        success: true,
        redirectUrl: authResult.redirectUrl,
        message: 'Please visit the URL to authorize Gmail access.',
        alreadyConnected: false,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to initiate Gmail connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

/**
 * Tool: Check Gmail Connection Status
 */
export const checkGmailConnectionTool = createTool({
  id: 'check-gmail-connection',
  description: 'Check if the user has connected their Gmail account',
  inputSchema: z.object({
    userId: z.string().describe('Unique identifier for the user'),
  }),
  outputSchema: z.object({
    connected: z.boolean(),
    connectionId: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      return await checkGmailConnection(context.userId);
    } catch (error) {
      return {
        connected: false,
        error: `Failed to check Gmail connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

/**
 * Tool: Fetch Emails via Composio
 * Verified action: GMAIL_FETCH_EMAILS
 */
export const fetchEmailsComposioTool = createTool({
  id: 'fetch-emails-composio',
  description: 'Fetch emails from Gmail using Composio integration',
  inputSchema: z.object({
    userId: z.string().describe('Unique identifier for the user'),
    maxResults: z.number().min(1).max(100).default(20).describe('Maximum number of emails to fetch'),
    query: z.string().optional().nullable().describe('Gmail search query (e.g., "is:unread", "from:someone@example.com")'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    emails: z.array(
      z.object({
        id: z.string(),
        threadId: z.string(),
        snippet: z.string(),
        subject: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        date: z.string().optional(),
        labelIds: z.array(z.string()).optional(),
      })
    ),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      // Verify Gmail connection first
      const connectionCheck = await ensureGmailConnected(context.userId);
      if (!connectionCheck.connected) {
        return {
          success: false,
          emails: [],
          error: connectionCheck.error,
        };
      }

      const result = await composio.tools.execute(GMAIL_ACTIONS.FETCH_EMAILS, {
        userId: context.userId,
        arguments: {
          max_results: context.maxResults,
          query: context.query,
          user_id: 'me',
        },
      });

      console.log('[Composio] FETCH_EMAILS raw result:', JSON.stringify(result, null, 2));

      const data = result.data as Record<string, unknown>;
      const emails = (data?.emails || data?.messages || []) as Array<{
        id: string;
        threadId: string;
        snippet: string;
        subject?: string;
        from?: string;
        to?: string;
        date?: string;
        labelIds?: string[];
      }>;

      return {
        success: true,
        emails,
      };
    } catch (error) {
      return {
        success: false,
        emails: [],
        error: error instanceof Error ? error.message : 'Failed to fetch emails',
      };
    }
  },
});

/**
 * Tool: Send Email via Composio
 * Verified action: GMAIL_SEND_EMAIL
 */
export const sendEmailComposioTool = createTool({
  id: 'send-email-composio',
  description: 'Send an email via Gmail using Composio integration',
  inputSchema: z.object({
    userId: z.string().describe('Unique identifier for the user'),
    to: z.string().email().describe('Recipient email address'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body (plain text)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      // Verify Gmail connection first
      const connectionCheck = await ensureGmailConnected(context.userId);
      if (!connectionCheck.connected) {
        return {
          success: false,
          error: connectionCheck.error,
        };
      }

      const result = await composio.tools.execute(GMAIL_ACTIONS.SEND_EMAIL, {
        userId: context.userId,
        arguments: {
          recipient_email: context.to,
          subject: context.subject,
          body: context.body,
        },
      });

      const data = result.data as Record<string, unknown>;
      return {
        success: true,
        messageId: (data?.message_id || data?.id || '') as string,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  },
});

/**
 * Tool: Reply to Email Thread via Composio
 * Verified action: GMAIL_REPLY_TO_THREAD
 */
export const replyToThreadComposioTool = createTool({
  id: 'reply-to-thread-composio',
  description: 'Reply to an email thread via Gmail using Composio integration',
  inputSchema: z.object({
    userId: z.string().describe('Unique identifier for the user'),
    threadId: z.string().describe('ID of the thread to reply to'),
    body: z.string().describe('Reply body (plain text)'),
    recipientEmail: z.string().email().optional().describe('Recipient email address'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      // Verify Gmail connection first
      const connectionCheck = await ensureGmailConnected(context.userId);
      if (!connectionCheck.connected) {
        return {
          success: false,
          error: connectionCheck.error,
        };
      }

      const result = await composio.tools.execute(GMAIL_ACTIONS.REPLY_TO_THREAD, {
        userId: context.userId,
        arguments: {
          thread_id: context.threadId,
          message_body: context.body,
          recipient_email: context.recipientEmail,
        },
      });

      const data = result.data as Record<string, unknown>;
      return {
        success: true,
        messageId: (data?.message_id || data?.id || '') as string,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reply to thread',
      };
    }
  },
});

/**
 * Tool: Create Draft via Composio
 * Verified action: GMAIL_CREATE_EMAIL_DRAFT
 */
export const createDraftComposioTool = createTool({
  id: 'create-draft-composio',
  description: 'Create a draft email in Gmail',
  inputSchema: z.object({
    userId: z.string().describe('Unique identifier for the user'),
    to: z.string().email().describe('Recipient email address'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body'),
    isHtml: z.boolean().default(false).describe('Whether the body content is HTML'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    draftId: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      // Verify Gmail connection first
      const connectionCheck = await ensureGmailConnected(context.userId);
      if (!connectionCheck.connected) {
        return {
          success: false,
          error: connectionCheck.error,
        };
      }

      const result = await composio.tools.execute(GMAIL_ACTIONS.CREATE_DRAFT, {
        userId: context.userId,
        arguments: {
          recipient_email: context.to,
          subject: context.subject,
          body: context.body,
          is_html: context.isHtml,
        },
      });

      const data = result.data as Record<string, unknown>;
      return {
        success: true,
        draftId: (data?.draft_id || data?.id || '') as string,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create draft',
      };
    }
  },
});

// Export all verified Composio email tools
export const composioEmailTools = {
  connectGmailTool,
  checkGmailConnectionTool,
  fetchEmailsComposioTool,
  sendEmailComposioTool,
  replyToThreadComposioTool,
  createDraftComposioTool,
};
