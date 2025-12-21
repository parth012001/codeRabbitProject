import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { LibSQLStore } from '@mastra/libsql';

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

  // Register tools for direct access
  tools: {
    // Legacy mock tools (for testing without Composio)
    fetchEmailsTool,
    classifyEmailTool,
    draftReplyTool,
    sendEmailTool,
    archiveEmailTool,
    labelEmailTool,
    searchEmailsTool,
    // Composio Gmail tools (verified from Composio docs)
    connectGmailTool,
    checkGmailConnectionTool,
    fetchEmailsComposioTool,
    sendEmailComposioTool,
    replyToThreadComposioTool,
    createDraftComposioTool,
  },

  // Configure storage for memory/state
  storage: new LibSQLStore({
    url: process.env.DATABASE_URL || 'file:./local.db',
  }),

  // Configure logging
  logger: createLogger({
    name: 'EmailAssistant',
    level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
  }),
});

// Export for external use
export { emailClassifierAgent, emailComposerAgent, emailManagerAgent };
export { inboxTriageWorkflow };
export * from './tools/index.js';

// Export Composio service for direct access
export * from '../services/composio.js';
