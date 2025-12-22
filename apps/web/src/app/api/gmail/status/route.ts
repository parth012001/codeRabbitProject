import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { GmailConnectionStatus, ApiErrorResponse } from '@email-assistant/types';
import { checkGmailConnection } from '@/lib/composio';

const TIMEOUT_MS = 10000; // 10 second timeout

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Request timed out after ${ms}ms`));
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

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { connected, connectionId } = await withTimeout(
      checkGmailConnection(userId),
      TIMEOUT_MS
    );

    return NextResponse.json<GmailConnectionStatus>({ connected, connectionId });
  } catch (error) {
    const isTimeout = error instanceof Error && error.message.includes('timed out');
    console.error('Failed to check Gmail connection:', error);

    if (isTimeout) {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Request timed out' },
        { status: 504 }
      );
    }

    return NextResponse.json<ApiErrorResponse>(
      { error: 'Failed to check Gmail connection' },
      { status: 500 }
    );
  }
}
