import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type {
  Email,
  EmailClassification,
  EmailDraft,
  EmailCategory,
  EmailPriority,
  EmailSentiment,
} from '@email-assistant/types';
import { generateId } from '@email-assistant/shared';

// Schema definitions
const emailAddressSchema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
});

const emailSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  from: emailAddressSchema,
  to: z.array(emailAddressSchema),
  cc: z.array(emailAddressSchema).optional(),
  subject: z.string(),
  body: z.string(),
  receivedAt: z.string(),
  isRead: z.boolean(),
  labels: z.array(z.string()),
});

// Tool: Fetch Emails
export const fetchEmailsTool = createTool({
  id: 'fetch-emails',
  description: 'Fetch emails from the inbox with optional filters',
  inputSchema: z.object({
    limit: z.number().min(1).max(100).default(20).describe('Number of emails to fetch'),
    unreadOnly: z.boolean().default(false).describe('Only fetch unread emails'),
    label: z.string().optional().describe('Filter by label'),
    searchQuery: z.string().optional().describe('Search query string'),
  }),
  outputSchema: z.object({
    emails: z.array(emailSchema),
    total: z.number(),
  }),
  execute: async ({ context }) => {
    // Mock implementation - replace with actual email provider integration
    const mockEmails: Email[] = [
      {
        id: generateId(),
        threadId: generateId(),
        from: { name: 'John Doe', email: 'john@example.com' },
        to: [{ email: 'user@example.com' }],
        subject: 'Urgent: Project deadline tomorrow',
        body: 'Hi, just a reminder that the project deadline is tomorrow. Please ensure all deliverables are ready.',
        receivedAt: new Date(),
        isRead: false,
        isStarred: false,
        labels: ['inbox', 'work'],
      },
      {
        id: generateId(),
        threadId: generateId(),
        from: { name: 'Newsletter', email: 'news@techcompany.com' },
        to: [{ email: 'user@example.com' }],
        subject: 'Weekly Tech Digest',
        body: 'This week in tech: AI advances, new product launches, and more...',
        receivedAt: new Date(Date.now() - 3600000),
        isRead: true,
        isStarred: false,
        labels: ['inbox', 'newsletter'],
      },
      {
        id: generateId(),
        threadId: generateId(),
        from: { name: 'Alice Smith', email: 'alice@company.com' },
        to: [{ email: 'user@example.com' }],
        subject: 'Re: Meeting notes from yesterday',
        body: 'Thanks for sending the notes. I have a few follow-up questions about the budget section.',
        receivedAt: new Date(Date.now() - 7200000),
        isRead: false,
        isStarred: true,
        labels: ['inbox', 'work'],
      },
    ];

    let filtered = mockEmails;

    if (context.unreadOnly) {
      filtered = filtered.filter((e) => !e.isRead);
    }

    if (context.label) {
      filtered = filtered.filter((e) => e.labels.includes(context.label!));
    }

    if (context.searchQuery) {
      const query = context.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.subject.toLowerCase().includes(query) || e.body.toLowerCase().includes(query)
      );
    }

    return {
      emails: filtered.slice(0, context.limit).map((e) => ({
        ...e,
        receivedAt: e.receivedAt.toISOString(),
      })),
      total: filtered.length,
    };
  },
});

// Tool: Classify Email
export const classifyEmailTool = createTool({
  id: 'classify-email',
  description: 'Classify an email by category, priority, and sentiment',
  inputSchema: z.object({
    emailId: z.string().describe('The ID of the email to classify'),
    subject: z.string().describe('The email subject'),
    body: z.string().describe('The email body content'),
    from: z.string().describe('The sender email address'),
  }),
  outputSchema: z.object({
    classification: z.object({
      category: z.enum([
        'important',
        'urgent',
        'newsletter',
        'promotional',
        'social',
        'notification',
        'personal',
        'work',
        'spam',
        'other',
      ]),
      priority: z.enum(['high', 'medium', 'low']),
      sentiment: z.enum(['positive', 'neutral', 'negative']),
      confidence: z.number().min(0).max(1),
      suggestedLabels: z.array(z.string()),
      requiresResponse: z.boolean(),
    }),
  }),
  execute: async ({ context }) => {
    // This would typically use the LLM to classify, but for now return mock data
    // In a real implementation, this tool would be called by an agent with LLM context

    const subject = context.subject.toLowerCase();
    const body = context.body.toLowerCase();

    let category: EmailCategory = 'other';
    let priority: EmailPriority = 'medium';
    let sentiment: EmailSentiment = 'neutral';
    let requiresResponse = false;

    // Simple rule-based classification (to be enhanced by LLM)
    if (subject.includes('urgent') || subject.includes('asap')) {
      category = 'urgent';
      priority = 'high';
      requiresResponse = true;
    } else if (subject.includes('newsletter') || context.from.includes('newsletter')) {
      category = 'newsletter';
      priority = 'low';
    } else if (subject.includes('promotion') || subject.includes('sale') || subject.includes('discount')) {
      category = 'promotional';
      priority = 'low';
    } else if (body.includes('meeting') || body.includes('deadline') || body.includes('project')) {
      category = 'work';
      priority = 'medium';
      requiresResponse = true;
    }

    // Sentiment detection (simplified)
    if (body.includes('thank') || body.includes('great') || body.includes('excellent')) {
      sentiment = 'positive';
    } else if (body.includes('issue') || body.includes('problem') || body.includes('urgent')) {
      sentiment = 'negative';
    }

    const classification: EmailClassification = {
      category,
      priority,
      sentiment,
      confidence: 0.85,
      suggestedLabels: [category, priority],
      requiresResponse,
    };

    return { classification };
  },
});

// Tool: Draft Reply
export const draftReplyTool = createTool({
  id: 'draft-reply',
  description: 'Generate a draft reply to an email',
  inputSchema: z.object({
    originalEmailId: z.string().describe('ID of the email to reply to'),
    originalSubject: z.string().describe('Subject of the original email'),
    originalBody: z.string().describe('Body of the original email'),
    originalFrom: emailAddressSchema.describe('Sender of the original email'),
    tone: z.enum(['formal', 'casual', 'friendly', 'professional']).default('professional'),
    keyPoints: z.array(z.string()).optional().describe('Key points to include in the reply'),
    userContext: z.string().optional().describe('Additional context from the user'),
  }),
  outputSchema: z.object({
    draft: z.object({
      to: z.array(emailAddressSchema),
      subject: z.string(),
      body: z.string(),
      inReplyTo: z.string(),
    }),
    suggestions: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    // This would be enhanced by LLM generation
    const replySubject = context.originalSubject.startsWith('Re:')
      ? context.originalSubject
      : `Re: ${context.originalSubject}`;

    // Simple template-based reply (LLM would generate this)
    let greeting = context.tone === 'formal' ? 'Dear' : 'Hi';
    let closing =
      context.tone === 'formal' ? 'Best regards,' : context.tone === 'casual' ? 'Cheers,' : 'Thanks,';

    const senderName = context.originalFrom.name || context.originalFrom.email.split('@')[0];

    const keyPointsText = context.keyPoints?.length
      ? `\n\nRegarding your email:\n${context.keyPoints.map((p) => `- ${p}`).join('\n')}`
      : '';

    const body = `${greeting} ${senderName},

Thank you for your email.${keyPointsText}

${context.userContext || 'I will review this and get back to you shortly.'}

${closing}
[Your Name]`;

    return {
      draft: {
        to: [context.originalFrom],
        subject: replySubject,
        body,
        inReplyTo: context.originalEmailId,
      },
      suggestions: [
        'Consider adding specific action items',
        'You may want to set a follow-up reminder',
        'Check if CC recipients should be included',
      ],
    };
  },
});

// Tool: Send Email
export const sendEmailTool = createTool({
  id: 'send-email',
  description: 'Send an email',
  inputSchema: z.object({
    to: z.array(emailAddressSchema).min(1).describe('Recipients'),
    cc: z.array(emailAddressSchema).optional().describe('CC recipients'),
    bcc: z.array(emailAddressSchema).optional().describe('BCC recipients'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body'),
    inReplyTo: z.string().optional().describe('ID of email being replied to'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    // Mock implementation - replace with actual email sending
    console.log('Sending email:', {
      to: context.to,
      subject: context.subject,
    });

    // Simulate sending
    return {
      success: true,
      messageId: generateId(),
    };
  },
});

// Tool: Archive Email
export const archiveEmailTool = createTool({
  id: 'archive-email',
  description: 'Archive an email (remove from inbox)',
  inputSchema: z.object({
    emailId: z.string().describe('ID of the email to archive'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    console.log('Archiving email:', context.emailId);
    return { success: true };
  },
});

// Tool: Label Email
export const labelEmailTool = createTool({
  id: 'label-email',
  description: 'Add or remove labels from an email',
  inputSchema: z.object({
    emailId: z.string().describe('ID of the email'),
    addLabels: z.array(z.string()).optional().describe('Labels to add'),
    removeLabels: z.array(z.string()).optional().describe('Labels to remove'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    currentLabels: z.array(z.string()),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    console.log('Updating labels for email:', context.emailId);
    return {
      success: true,
      currentLabels: context.addLabels || [],
    };
  },
});

// Tool: Search Emails
export const searchEmailsTool = createTool({
  id: 'search-emails',
  description: 'Search emails with advanced query',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    from: z.string().optional().describe('Filter by sender'),
    to: z.string().optional().describe('Filter by recipient'),
    subject: z.string().optional().describe('Filter by subject'),
    hasAttachment: z.boolean().optional().describe('Filter by attachment presence'),
    dateFrom: z.string().optional().describe('Start date (ISO format)'),
    dateTo: z.string().optional().describe('End date (ISO format)'),
    limit: z.number().min(1).max(100).default(20),
  }),
  outputSchema: z.object({
    emails: z.array(emailSchema),
    total: z.number(),
  }),
  execute: async ({ context }) => {
    console.log('Searching emails with query:', context.query);
    // Mock implementation
    return {
      emails: [],
      total: 0,
    };
  },
});

// Export all tools
export const emailTools = {
  fetchEmailsTool,
  classifyEmailTool,
  draftReplyTool,
  sendEmailTool,
  archiveEmailTool,
  labelEmailTool,
  searchEmailsTool,
};
