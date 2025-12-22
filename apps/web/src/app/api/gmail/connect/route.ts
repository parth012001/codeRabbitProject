import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { GmailConnectResponse, ApiErrorResponse } from '@email-assistant/types';
import { authorizeGmail } from '@/lib/composio';
import { getBaseUrl } from '@/lib/utils/url';
import { withTimeout } from '@/lib/utils/timeout';

const TIMEOUT_MS = 15000; // 15 second timeout

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

    const isTimeout = error instanceof Error && error.message.includes('timed out');
    if (isTimeout) {
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
