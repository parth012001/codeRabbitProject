import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { UserSettingsResponse, ApiErrorResponse } from '@email-assistant/types';

function getMastraBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_MASTRA_API_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_MASTRA_API_URL is not configured');
  }
  // Remove /api suffix if present - custom Mastra routes are at root level
  return url.replace(/\/api$/, '');
}

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
    const { userId, getToken } = await auth();

    if (!userId) {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = await getToken();
    const response = await withTimeout(
      fetch(`${getMastraBaseUrl()}/settings/get`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }),
      TIMEOUT_MS
    );

    // Get raw text first to handle non-JSON responses
    const text = await response.text();

    // Try to parse as JSON
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('Failed to parse settings response:', text.substring(0, 200));
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Invalid response from settings API' },
        { status: 502 }
      );
    }

    if (!response.ok) {
      const errorData = data as { error?: string };
      return NextResponse.json<ApiErrorResponse>(
        { error: errorData.error || 'Failed to fetch settings' },
        { status: response.status }
      );
    }

    return NextResponse.json<UserSettingsResponse>(data as UserSettingsResponse);
  } catch (error) {
    console.error('Failed to fetch settings:', error);

    const isTimeout = error instanceof Error && error.message.includes('timed out');
    if (isTimeout) {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Request timed out' },
        { status: 504 }
      );
    }

    return NextResponse.json<ApiErrorResponse>(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { userId, getToken } = await auth();

    if (!userId) {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const token = await getToken();

    const response = await withTimeout(
      fetch(`${getMastraBaseUrl()}/settings/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }),
      TIMEOUT_MS
    );

    // Get raw text first to handle non-JSON responses
    const text = await response.text();

    // Try to parse as JSON
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('Failed to parse settings update response:', text.substring(0, 200));
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Invalid response from settings API' },
        { status: 502 }
      );
    }

    if (!response.ok) {
      const errorData = data as { error?: string };
      return NextResponse.json<ApiErrorResponse>(
        { error: errorData.error || 'Failed to update settings' },
        { status: response.status }
      );
    }

    return NextResponse.json<UserSettingsResponse>(data as UserSettingsResponse);
  } catch (error) {
    console.error('Failed to update settings:', error);

    const isTimeout = error instanceof Error && error.message.includes('timed out');
    if (isTimeout) {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Request timed out' },
        { status: 504 }
      );
    }

    return NextResponse.json<ApiErrorResponse>(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
