import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { CalendarConnectResponse, ApiErrorResponse } from '@email-assistant/types';
import { authorizeCalendar } from '@/lib/composio';
import { getBaseUrl } from '@/lib/utils/url';
import { withTimeout } from '@/lib/utils/timeout';

const TIMEOUT_MS = 15000;

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
