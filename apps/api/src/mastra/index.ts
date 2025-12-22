import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { registerApiRoute } from '@mastra/core/server';
import { verifyToken } from '@clerk/backend';

import { emailClassifierAgent, emailComposerAgent, emailManagerAgent } from './agents/index.js';
import { inboxTriageWorkflow } from './workflows/index.js';
import {
  fetchEmailsTool,
  classifyEmailTool,
  draftReplyTool,
  sendEmailTool,
  archiveEmailTool,
  labelEmailTool,
  searchEmailsTool,
} from './tools/email-tools.js';
import {
  connectGmailTool,
  checkGmailConnectionTool,
  fetchEmailsComposioTool,
  sendEmailComposioTool,
  replyToThreadComposioTool,
  createDraftComposioTool,
} from './tools/composio-email-tools.js';
import { handleEmailWebhook } from '../services/email-webhook-handler.js';
import { createGmailTrigger, listUserTriggers } from '../services/composio.js';

// Clerk secret key for JWT verification
const clerkSecretKey = process.env.CLERK_SECRET_KEY;

// Request context type (from Hono via Mastra)
interface RequestContext {
  req: {
    header: (name: string) => string | undefined;
    json: () => Promise<unknown>;
    query: (name: string) => string | undefined;
  };
  json: (data: unknown, status?: number) => Response;
}

/**
 * Verify authentication from request and return authenticated user ID
 * @param c - Request context
 * @returns Authenticated user ID or null if not authenticated
 */
async function verifyAuth(c: RequestContext): Promise<{ userId: string } | null> {
  if (!clerkSecretKey) {
    console.warn('[Auth] CLERK_SECRET_KEY not set - authentication disabled');
    return null;
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);

  try {
    const result = await verifyToken(token, { secretKey: clerkSecretKey });

    // The result contains JWT claims with 'sub' being the user ID
    // Type assertion needed as @clerk/backend types are loosely defined
    const payload = result as { sub?: string };

    if (!payload?.sub) {
      console.error('[Auth] Token verification failed - no user ID in token');
      return null;
    }

    return { userId: payload.sub };
  } catch (error) {
    console.error('[Auth] Token verification error:', error);
    return null;
  }
}

// Create the Mastra instance
export const mastra = new Mastra({
  // Register all agents
  agents: {
    emailClassifierAgent,
    emailComposerAgent,
    emailManagerAgent,
  },

  // Register workflows
  workflows: {
    inboxTriageWorkflow,
  },

  // No global storage - agents are stateless for MVP
  // Add storage later when conversation memory is needed

  // Configure logging
  logger: createLogger({
    name: 'EmailAssistant',
    level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
  }),

  // Server configuration with custom webhook routes
  server: {
    apiRoutes: [
      // Composio webhook endpoint for Gmail triggers
      registerApiRoute('/composio/webhook', {
        method: 'POST',
        handler: async (c) => {
          try {
            const payload = await c.req.json();
            console.log('[Webhook] Received Composio event:', JSON.stringify(payload, null, 2));

            const result = await handleEmailWebhook(payload);

            return c.json({
              status: 'received',
              processed: result.processed,
              draftId: result.draftId,
              message: result.message,
            });
          } catch (error) {
            console.error('[Webhook] Error processing event:', error);
            return c.json(
              {
                status: 'error',
                message: error instanceof Error ? error.message : 'Unknown error',
              },
              500
            );
          }
        },
      }),

      // Health check endpoint
      registerApiRoute('/composio/health', {
        method: 'GET',
        handler: async (c) => {
          return c.json({ status: 'ok', timestamp: new Date().toISOString() });
        },
      }),

      // Set up Gmail trigger for a user (requires authentication)
      registerApiRoute('/composio/triggers/setup', {
        method: 'POST',
        handler: async (c) => {
          try {
            // Verify authentication
            const auth = await verifyAuth(c);
            if (!auth) {
              return c.json({ success: false, error: 'Authentication required' }, 401);
            }

            const body = await c.req.json();
            const targetUserId = body.userId;

            if (!targetUserId) {
              return c.json({ success: false, error: 'userId is required' }, 400);
            }

            // Ensure authenticated user can only set up triggers for themselves
            // (extend this check for admin scope if needed in the future)
            if (auth.userId !== targetUserId) {
              console.warn(`[Triggers] User ${auth.userId} attempted to set up trigger for ${targetUserId}`);
              return c.json({ success: false, error: 'Not authorized to set up triggers for other users' }, 403);
            }

            console.log(`[Triggers] Setting up Gmail trigger for user: ${auth.userId}`);
            const result = await createGmailTrigger(auth.userId);

            return c.json(result);
          } catch (error) {
            console.error('[Triggers] Error setting up trigger:', error);
            return c.json(
              {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              },
              500
            );
          }
        },
      }),

      // List user's triggers (requires authentication)
      registerApiRoute('/composio/triggers', {
        method: 'GET',
        handler: async (c) => {
          try {
            // Verify authentication
            const auth = await verifyAuth(c);
            if (!auth) {
              return c.json({ success: false, error: 'Authentication required' }, 401);
            }

            const targetUserId = c.req.query('userId');

            if (!targetUserId) {
              return c.json({ success: false, error: 'userId query param is required' }, 400);
            }

            // Ensure authenticated user can only list their own triggers
            if (auth.userId !== targetUserId) {
              return c.json({ success: false, error: 'Not authorized to list triggers for other users' }, 403);
            }

            const result = await listUserTriggers(auth.userId);
            return c.json(result);
          } catch (error) {
            console.error('[Triggers] Error listing triggers:', error);
            return c.json(
              {
                triggers: [],
                error: error instanceof Error ? error.message : 'Unknown error',
              },
              500
            );
          }
        },
      }),
    ],
  },
});

// Export for external use
export { emailClassifierAgent, emailComposerAgent, emailManagerAgent };
export { inboxTriageWorkflow };
export * from './tools/index.js';

// Export Composio service for direct access
export * from '../services/composio.js';
