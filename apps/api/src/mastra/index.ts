import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { registerApiRoute } from '@mastra/core/server';

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

      // Set up Gmail trigger for a user
      registerApiRoute('/composio/triggers/setup', {
        method: 'POST',
        handler: async (c) => {
          try {
            const body = await c.req.json();
            const userId = body.userId;

            if (!userId) {
              return c.json({ success: false, error: 'userId is required' }, 400);
            }

            // Get the webhook URL from environment or construct it
            const baseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:4111';
            const webhookUrl = `${baseUrl}/composio/webhook`;

            console.log(`[Triggers] Setting up Gmail trigger for user: ${userId}`);
            const result = await createGmailTrigger(userId, webhookUrl);

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

      // List user's triggers
      registerApiRoute('/composio/triggers', {
        method: 'GET',
        handler: async (c) => {
          try {
            const userId = c.req.query('userId');

            if (!userId) {
              return c.json({ success: false, error: 'userId query param is required' }, 400);
            }

            const result = await listUserTriggers(userId);
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
