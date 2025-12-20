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
} from './tools/index.js';

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
    fetchEmailsTool,
    classifyEmailTool,
    draftReplyTool,
    sendEmailTool,
    archiveEmailTool,
    labelEmailTool,
    searchEmailsTool,
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
