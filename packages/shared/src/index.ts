import type { Email, EmailAddress, EmailThread } from '@email-assistant/types';

// Email Utilities
export function formatEmailAddress(address: EmailAddress): string {
  if (address.name) {
    return `${address.name} <${address.email}>`;
  }
  return address.email;
}

export function parseEmailAddress(input: string): EmailAddress {
  const match = input.match(/^(?:(.+?)\s*)?<(.+?)>$/);
  if (match) {
    return {
      name: match[1]?.trim(),
      email: match[2].trim(),
    };
  }
  return { email: input.trim() };
}

export function extractDomain(email: string): string {
  return email.split('@')[1] || '';
}

// Thread Utilities
export function getThreadParticipants(thread: EmailThread): EmailAddress[] {
  const seen = new Set<string>();
  const participants: EmailAddress[] = [];

  for (const email of thread.emails) {
    const addresses = [email.from, ...email.to, ...(email.cc || [])];
    for (const addr of addresses) {
      if (!seen.has(addr.email)) {
        seen.add(addr.email);
        participants.push(addr);
      }
    }
  }

  return participants;
}

export function getThreadSnippet(thread: EmailThread, maxLength = 100): string {
  const lastEmail = thread.emails[thread.emails.length - 1];
  if (!lastEmail) return '';

  const text = lastEmail.body.replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;

  return text.substring(0, maxLength - 3) + '...';
}

// Date Utilities
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return date.toLocaleDateString();
  }
  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return 'just now';
}

// Text Utilities
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// Validation Utilities
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ID Generation
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Sleep utility for rate limiting
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry utility
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; delayMs?: number; backoff?: boolean } = {}
): Promise<T> {
  const { maxAttempts = 3, delayMs = 1000, backoff = true } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        const delay = backoff ? delayMs * Math.pow(2, attempt - 1) : delayMs;
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
