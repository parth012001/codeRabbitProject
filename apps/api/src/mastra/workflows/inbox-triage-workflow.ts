import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

// Define the workflow input schema
const triggerSchema = z.object({
  userId: z.string().describe('The user ID to triage inbox for'),
  maxEmails: z.number().default(20).describe('Maximum emails to process'),
  includeRead: z.boolean().default(false).describe('Include already read emails'),
});

// Step 1: Fetch unread emails
const fetchUnreadEmailsStep = createStep({
  id: 'fetch-unread-emails',
  inputSchema: triggerSchema,
  outputSchema: z.object({
    emails: z.array(
      z.object({
        id: z.string(),
        from: z.string(),
        subject: z.string(),
        body: z.string(),
        receivedAt: z.string(),
      })
    ),
    totalCount: z.number(),
  }),
  execute: async ({ inputData }) => {
    // This would integrate with the actual email provider
    // For now, return mock data
    const mockEmails = [
      {
        id: '1',
        from: 'boss@company.com',
        subject: 'Urgent: Q4 Report Review',
        body: 'Please review the Q4 report before our meeting tomorrow at 10 AM.',
        receivedAt: new Date().toISOString(),
      },
      {
        id: '2',
        from: 'newsletter@techweekly.com',
        subject: 'This Week in Tech',
        body: 'Top stories: AI advances, new product launches...',
        receivedAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: '3',
        from: 'colleague@company.com',
        subject: 'Re: Project Timeline',
        body: 'Thanks for the update. I have a few questions about the milestones.',
        receivedAt: new Date(Date.now() - 7200000).toISOString(),
      },
    ];

    return {
      emails: mockEmails.slice(0, inputData.maxEmails),
      totalCount: mockEmails.length,
    };
  },
});

// Step 2: Classify each email
const classifyEmailsStep = createStep({
  id: 'classify-emails',
  inputSchema: z.object({
    emails: z.array(
      z.object({
        id: z.string(),
        from: z.string(),
        subject: z.string(),
        body: z.string(),
        receivedAt: z.string(),
      })
    ),
    totalCount: z.number(),
  }),
  outputSchema: z.object({
    classifiedEmails: z.array(
      z.object({
        id: z.string(),
        from: z.string(),
        subject: z.string(),
        category: z.string(),
        priority: z.enum(['high', 'medium', 'low']),
        requiresResponse: z.boolean(),
        suggestedAction: z.string(),
      })
    ),
  }),
  execute: async ({ inputData }) => {
    const classifiedEmails = inputData.emails.map((email) => {
      // Simple classification logic (would be enhanced by LLM)
      let category = 'other';
      let priority: 'high' | 'medium' | 'low' = 'medium';
      let requiresResponse = false;
      let suggestedAction = 'review';

      const subject = email.subject.toLowerCase();
      const from = email.from.toLowerCase();

      if (subject.includes('urgent') || subject.includes('asap')) {
        category = 'urgent';
        priority = 'high';
        requiresResponse = true;
        suggestedAction = 'respond immediately';
      } else if (from.includes('newsletter') || subject.includes('digest')) {
        category = 'newsletter';
        priority = 'low';
        suggestedAction = 'read later or archive';
      } else if (subject.includes('re:') || subject.includes('fwd:')) {
        category = 'conversation';
        priority = 'medium';
        requiresResponse = true;
        suggestedAction = 'continue conversation';
      } else if (from.includes('company.com')) {
        category = 'work';
        priority = 'medium';
        requiresResponse = true;
        suggestedAction = 'review and respond';
      }

      return {
        id: email.id,
        from: email.from,
        subject: email.subject,
        category,
        priority,
        requiresResponse,
        suggestedAction,
      };
    });

    return { classifiedEmails };
  },
});

// Step 3: Generate summary and recommendations
const generateSummaryStep = createStep({
  id: 'generate-summary',
  inputSchema: z.object({
    classifiedEmails: z.array(
      z.object({
        id: z.string(),
        from: z.string(),
        subject: z.string(),
        category: z.string(),
        priority: z.enum(['high', 'medium', 'low']),
        requiresResponse: z.boolean(),
        suggestedAction: z.string(),
      })
    ),
  }),
  outputSchema: z.object({
    summary: z.object({
      totalEmails: z.number(),
      highPriority: z.number(),
      requiresResponse: z.number(),
      byCategory: z.record(z.number()),
    }),
    prioritizedList: z.array(
      z.object({
        id: z.string(),
        from: z.string(),
        subject: z.string(),
        priority: z.string(),
        action: z.string(),
      })
    ),
    recommendations: z.array(z.string()),
  }),
  execute: async ({ inputData }) => {
    const emails = inputData.classifiedEmails;

    // Calculate summary
    const byCategory: Record<string, number> = {};
    emails.forEach((email) => {
      byCategory[email.category] = (byCategory[email.category] || 0) + 1;
    });

    const summary = {
      totalEmails: emails.length,
      highPriority: emails.filter((e) => e.priority === 'high').length,
      requiresResponse: emails.filter((e) => e.requiresResponse).length,
      byCategory,
    };

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const prioritizedList = [...emails]
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
      .map((email) => ({
        id: email.id,
        from: email.from,
        subject: email.subject,
        priority: email.priority,
        action: email.suggestedAction,
      }));

    // Generate recommendations
    const recommendations: string[] = [];

    if (summary.highPriority > 0) {
      recommendations.push(
        `You have ${summary.highPriority} high-priority email(s) that need immediate attention.`
      );
    }

    if (summary.requiresResponse > 0) {
      recommendations.push(
        `${summary.requiresResponse} email(s) are waiting for your response.`
      );
    }

    if (byCategory['newsletter'] > 2) {
      recommendations.push(
        `Consider batch-processing your ${byCategory['newsletter']} newsletters or setting up filters.`
      );
    }

    return {
      summary,
      prioritizedList,
      recommendations,
    };
  },
});

// Create the workflow
export const inboxTriageWorkflow = createWorkflow({
  id: 'inbox-triage',
  inputSchema: triggerSchema,
  outputSchema: z.object({
    summary: z.object({
      totalEmails: z.number(),
      highPriority: z.number(),
      requiresResponse: z.number(),
      byCategory: z.record(z.number()),
    }),
    prioritizedList: z.array(
      z.object({
        id: z.string(),
        from: z.string(),
        subject: z.string(),
        priority: z.string(),
        action: z.string(),
      })
    ),
    recommendations: z.array(z.string()),
  }),
})
  .then(fetchUnreadEmailsStep)
  .then(classifyEmailsStep)
  .then(generateSummaryStep);

inboxTriageWorkflow.commit();
