import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { CalendarConnectionStatus, ApiErrorResponse } from '@email-assistant/types';
import { checkCalendarConnection } from '@/lib/composio';

const TIMEOUT_MS = 10000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Request timed out after ${ms}ms`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
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
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { connected, connectionId } = await withTimeout(
      checkCalendarConnection(userId),
      TIMEOUT_MS
    );

    return NextResponse.json<CalendarConnectionStatus>({ connected, connectionId });
  } catch (error) {
    const isTimeout = error instanceof Error && error.message.includes('timed out');
    console.error('Failed to check Calendar connection:', error);

    if (isTimeout) {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Request timed out' },
        { status: 504 }
      );
    }

    return NextResponse.json<ApiErrorResponse>(
      { error: 'Failed to check Calendar connection' },
      { status: 500 }
    );
  }
}
