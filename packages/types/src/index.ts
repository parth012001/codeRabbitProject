// Email Types
export interface Email {
  id: string;
  threadId: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: string;
  bodyHtml?: string;
  receivedAt: Date;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
  attachments?: Attachment[];
}

export interface EmailAddress {
  name?: string;
  email: string;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url?: string;
}

export interface EmailThread {
  id: string;
  subject: string;
  participants: EmailAddress[];
  emails: Email[];
  lastMessageAt: Date;
  snippet: string;
}

// Email Classification Types
export type EmailCategory =
  | 'important'
  | 'urgent'
  | 'newsletter'
  | 'promotional'
  | 'social'
  | 'notification'
  | 'personal'
  | 'work'
  | 'spam'
  | 'other';

export type EmailPriority = 'high' | 'medium' | 'low';

export type EmailSentiment = 'positive' | 'neutral' | 'negative';

export interface EmailClassification {
  category: EmailCategory;
  priority: EmailPriority;
  sentiment: EmailSentiment;
  confidence: number;
  suggestedLabels: string[];
  requiresResponse: boolean;
  responseDeadline?: Date;
}

// Email Action Types
export type EmailActionType =
  | 'reply'
  | 'forward'
  | 'archive'
  | 'delete'
  | 'star'
  | 'label'
  | 'snooze'
  | 'mark_read'
  | 'mark_unread';

export interface EmailAction {
  type: EmailActionType;
  emailId: string;
  payload?: Record<string, unknown>;
}

// Draft Types
export interface EmailDraft {
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: string;
  bodyHtml?: string;
  inReplyTo?: string;
  attachments?: Attachment[];
}

export interface DraftSuggestion {
  draft: EmailDraft;
  tone: 'formal' | 'casual' | 'friendly' | 'professional';
  confidence: number;
  reasoning: string;
}

// Agent Types
export interface AgentContext {
  userId: string;
  sessionId: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  timezone: string;
  language: string;
  responseStyle: 'brief' | 'detailed';
  autoArchive: boolean;
  priorityContacts: string[];
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Pagination Types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
