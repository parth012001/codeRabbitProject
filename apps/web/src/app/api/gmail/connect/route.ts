import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { GmailConnectResponse, ApiErrorResponse } from '@email-assistant/types';
import { authorizeGmail } from '@/lib/composio';

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Request timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

// Server-controlled base URL - must be configured in environment
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3001';
}

const TIMEOUT_MS = 15000; // 15 second timeout

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(ms));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use server-configured base URL for callback, not client-supplied origin
    const callbackUrl = `${getBaseUrl()}/api/gmail/callback`;

    const { redirectUrl, connectionId } = await withTimeout(
      authorizeGmail(userId, callbackUrl),
      TIMEOUT_MS
    );

    return NextResponse.json<GmailConnectResponse>({ redirectUrl, connectionId });
  } catch (error) {
    console.error('Failed to initiate Gmail connection:', error);

    if (error instanceof TimeoutError) {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Request timed out' },
        { status: 504 }
      );
    }

    return NextResponse.json<ApiErrorResponse>(
      { error: 'Failed to initiate Gmail connection' },
      { status: 500 }
    );
  }
}
