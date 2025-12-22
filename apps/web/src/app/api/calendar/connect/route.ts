import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { CalendarConnectResponse, ApiErrorResponse } from '@email-assistant/types';
import { authorizeCalendar } from '@/lib/composio';

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3001';
}

const TIMEOUT_MS = 15000;

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

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const callbackUrl = `${getBaseUrl()}/api/calendar/callback`;

    const result = await withTimeout(
      authorizeCalendar(userId, callbackUrl),
      TIMEOUT_MS
    );

    // If already connected, return success without redirect
    if (result.alreadyConnected) {
      return NextResponse.json<CalendarConnectResponse>({
        connectionId: result.connectionId,
        alreadyConnected: true,
      });
    }

    return NextResponse.json<CalendarConnectResponse>({
      redirectUrl: result.redirectUrl,
      connectionId: result.connectionId,
    });
  } catch (error) {
    console.error('Failed to initiate Calendar connection:', error);

    const isTimeout = error instanceof Error && error.message.includes('timed out');

    if (isTimeout) {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Request timed out' },
        { status: 504 }
      );
    }

    return NextResponse.json<ApiErrorResponse>(
      { error: 'Failed to initiate Calendar connection' },
      { status: 500 }
    );
  }
}
