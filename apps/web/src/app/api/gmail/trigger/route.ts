import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { ApiErrorResponse } from '@email-assistant/types';
import { withTimeout } from '@/lib/utils/timeout';
import { getMastraBaseUrl } from '@/lib/api';

const TIMEOUT_MS = 15000;

interface TriggerSetupResponse {
  success: boolean;
  triggerId?: string;
  error?: string;
}

export async function POST() {
  try {
    const { userId, getToken } = await auth();

    if (!userId) {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = await getToken();
    const response = await withTimeout(
      fetch(`${getMastraBaseUrl()}/composio/triggers/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      }),
      TIMEOUT_MS
    );

    const text = await response.text();

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('Failed to parse trigger setup response:', text.substring(0, 200));
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Invalid response from trigger API' },
        { status: 502 }
      );
    }

    if (!response.ok) {
      const errorData = data as { error?: string };
      return NextResponse.json<ApiErrorResponse>(
        { error: errorData.error || 'Failed to setup Gmail trigger' },
        { status: response.status }
      );
    }

    return NextResponse.json<TriggerSetupResponse>(data as TriggerSetupResponse);
  } catch (error) {
    console.error('Failed to setup Gmail trigger:', error);

    const isTimeout = error instanceof Error && error.message.includes('timed out');
    if (isTimeout) {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Request timed out' },
        { status: 504 }
      );
    }

    return NextResponse.json<ApiErrorResponse>(
      { error: 'Failed to setup Gmail trigger' },
      { status: 500 }
    );
  }
}
