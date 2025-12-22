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
import {
  createGmailTrigger,
  listUserTriggers,
  authorizeGoogleCalendar,
  checkCalendarConnection,
} from '../services/composio.js';
import { checkAvailability, getAvailableSlots } from '../services/calendar-service.js';
import { detectMeetingRequest } from '../services/meeting-detector.js';
import { getUserSettings, upsertUserSettings } from '../services/user-profile.js';
import { generateBrief } from '../services/brief-service.js';

// Clerk secret key for JWT verification
const clerkSecretKey = process.env.CLERK_SECRET_KEY;

// Fail-fast in production if CLERK_SECRET_KEY is missing
if (!clerkSecretKey && process.env.NODE_ENV === 'production') {
  throw new Error('CLERK_SECRET_KEY environment variable is required in production');
}

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

      // ========================================================================
      // Google Calendar Endpoints
      // ========================================================================

      // Connect Google Calendar (initiate OAuth)
      registerApiRoute('/calendar/connect', {
        method: 'POST',
        handler: async (c) => {
          try {
            // Verify authentication
            const auth = await verifyAuth(c);
            if (!auth) {
              return c.json({ success: false, error: 'Authentication required' }, 401);
            }

            const body = (await c.req.json()) as { callbackUrl?: string };
            const callbackUrl = body.callbackUrl;

            console.log(`[Calendar] Initiating connection for user: ${auth.userId}`);
            const result = await authorizeGoogleCalendar(auth.userId, callbackUrl);

            if (result.alreadyConnected) {
              return c.json({
                success: true,
                alreadyConnected: true,
                connectionId: result.connectionId,
                message: 'Google Calendar is already connected',
              });
            }

            return c.json({
              success: true,
              redirectUrl: result.redirectUrl,
              connectionId: result.connectionId,
            });
          } catch (error) {
            console.error('[Calendar] Error connecting:', error);
            return c.json(
              {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to connect Google Calendar',
              },
              500
            );
          }
        },
      }),

      // Check Google Calendar connection status
      registerApiRoute('/calendar/status', {
        method: 'GET',
        handler: async (c) => {
          try {
            // Verify authentication
            const auth = await verifyAuth(c);
            if (!auth) {
              return c.json({ success: false, error: 'Authentication required' }, 401);
            }

            console.log(`[Calendar] Checking connection for user: ${auth.userId}`);
            const result = await checkCalendarConnection(auth.userId);

            return c.json({
              success: true,
              connected: result.connected,
              connectionId: result.connectionId,
            });
          } catch (error) {
            console.error('[Calendar] Error checking status:', error);
            return c.json(
              {
                success: false,
                connected: false,
                error: error instanceof Error ? error.message : 'Failed to check connection',
              },
              500
            );
          }
        },
      }),

      // Check availability for a specific time slot
      registerApiRoute('/calendar/availability', {
        method: 'POST',
        handler: async (c) => {
          try {
            // Verify authentication
            const auth = await verifyAuth(c);
            if (!auth) {
              return c.json({ success: false, error: 'Authentication required' }, 401);
            }

            const body = (await c.req.json()) as {
              startTime: string;
              endTime: string;
            };

            if (!body.startTime || !body.endTime) {
              return c.json(
                { success: false, error: 'startTime and endTime are required (ISO format)' },
                400
              );
            }

            console.log(`[Calendar] Checking availability from ${body.startTime} to ${body.endTime}`);
            const result = await checkAvailability(auth.userId, body.startTime, body.endTime);

            return c.json({
              success: true,
              ...result,
            });
          } catch (error) {
            console.error('[Calendar] Error checking availability:', error);
            return c.json(
              {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to check availability',
              },
              500
            );
          }
        },
      }),

      // Get available time slots for a specific date
      registerApiRoute('/calendar/slots', {
        method: 'GET',
        handler: async (c) => {
          try {
            // Verify authentication
            const auth = await verifyAuth(c);
            if (!auth) {
              return c.json({ success: false, error: 'Authentication required' }, 401);
            }

            const dateParam = c.req.query('date');
            if (!dateParam) {
              return c.json({ success: false, error: 'date query param is required (YYYY-MM-DD)' }, 400);
            }

            const date = new Date(dateParam);
            if (isNaN(date.getTime())) {
              return c.json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD' }, 400);
            }

            console.log(`[Calendar] Getting available slots for ${dateParam}`);
            const result = await getAvailableSlots(auth.userId, date);

            return c.json({
              success: true,
              date: dateParam,
              slots: result.slots,
              error: result.error,
            });
          } catch (error) {
            console.error('[Calendar] Error getting slots:', error);
            return c.json(
              {
                success: false,
                slots: [],
                error: error instanceof Error ? error.message : 'Failed to get slots',
              },
              500
            );
          }
        },
      }),

      // ========================================================================
      // Meeting Detection Endpoints
      // ========================================================================

      // Detect if an email is a meeting request (for testing/manual analysis)
      registerApiRoute('/meeting/detect', {
        method: 'POST',
        handler: async (c) => {
          try {
            // Verify authentication
            const auth = await verifyAuth(c);
            if (!auth) {
              return c.json({ success: false, error: 'Authentication required' }, 401);
            }

            const body = (await c.req.json()) as {
              from?: string;
              subject?: string;
              body?: string;
            };

            if (!body.from || !body.subject || !body.body) {
              return c.json(
                { success: false, error: 'from, subject, and body are required' },
                400
              );
            }

            console.log(`[MeetingDetect] Analyzing email from: ${body.from}`);
            const classification = await detectMeetingRequest({
              from: body.from,
              subject: body.subject,
              body: body.body,
            });

            return c.json({
              success: true,
              classification,
            });
          } catch (error) {
            console.error('[MeetingDetect] Error detecting meeting:', error);
            return c.json(
              {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to detect meeting',
              },
              500
            );
          }
        },
      }),

      // ========================================================================
      // User Settings Endpoints
      // ========================================================================

      // Get user settings
      registerApiRoute('/settings/get', {
        method: 'GET',
        handler: async (c) => {
          try {
            const auth = await verifyAuth(c);
            if (!auth) {
              return c.json({ success: false, error: 'Authentication required' }, 401);
            }

            const settings = await getUserSettings(auth.userId);

            return c.json({
              success: true,
              settings: settings ?? {
                calendlyUrl: null,
                workingHoursStart: 9,
                workingHoursEnd: 17,
                timezone: 'UTC',
                calendarEnabled: false,
              },
            });
          } catch (error) {
            console.error('[Settings] Error getting settings:', error);
            return c.json(
              {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get settings',
              },
              500
            );
          }
        },
      }),

      // Update user settings
      registerApiRoute('/settings/update', {
        method: 'POST',
        handler: async (c) => {
          try {
            const auth = await verifyAuth(c);
            if (!auth) {
              return c.json({ success: false, error: 'Authentication required' }, 401);
            }

            const body = (await c.req.json()) as {
              calendlyUrl?: string;
              workingHoursStart?: number;
              workingHoursEnd?: number;
              timezone?: string;
              calendarEnabled?: boolean;
            };

            // Validate working hours if provided
            if (body.workingHoursStart !== undefined) {
              if (body.workingHoursStart < 0 || body.workingHoursStart > 23) {
                return c.json(
                  { success: false, error: 'workingHoursStart must be between 0 and 23' },
                  400
                );
              }
            }
            if (body.workingHoursEnd !== undefined) {
              if (body.workingHoursEnd < 0 || body.workingHoursEnd > 23) {
                return c.json(
                  { success: false, error: 'workingHoursEnd must be between 0 and 23' },
                  400
                );
              }
            }

            // Validate that start time is before end time when both are provided
            if (body.workingHoursStart !== undefined && body.workingHoursEnd !== undefined) {
              if (body.workingHoursStart >= body.workingHoursEnd) {
                return c.json(
                  { success: false, error: 'workingHoursStart must be before workingHoursEnd' },
                  400
                );
              }
            }

            console.log(`[Settings] Updating settings for user: ${auth.userId}`);
            const settings = await upsertUserSettings(auth.userId, body);

            return c.json({
              success: true,
              settings,
            });
          } catch (error) {
            console.error('[Settings] Error updating settings:', error);
            return c.json(
              {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update settings',
              },
              500
            );
          }
        },
      }),

      // ========================================================================
      // Brief Endpoint
      // ========================================================================

      // Generate email brief for the user
      registerApiRoute('/brief', {
        method: 'GET',
        handler: async (c) => {
          try {
            const auth = await verifyAuth(c);
            if (!auth) {
              return c.json({ success: false, error: 'Authentication required' }, 401);
            }

            console.log(`[Brief] Generating brief for user: ${auth.userId.substring(0, 8)}...`);
            const brief = await generateBrief(auth.userId);

            return c.json({
              success: true,
              brief,
            });
          } catch (error) {
            console.error('[Brief] Error generating brief:', error);
            return c.json(
              {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to generate brief',
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
