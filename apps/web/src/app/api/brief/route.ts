import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { BriefResponse, ApiErrorResponse } from '@email-assistant/types';
import { withTimeout } from '@/lib/utils/timeout';

function getMastraBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_MASTRA_API_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_MASTRA_API_URL is not configured');
  }
  // Remove /api suffix if present - custom Mastra routes are at root level
  return url.replace(/\/api$/, '');
}

// Extended timeout for AI summary generation
const TIMEOUT_MS = 15000;

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
      fetch(`${getMastraBaseUrl()}/brief`, {
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
      console.error('Failed to parse brief response:', text.substring(0, 200));
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Invalid response from brief API' },
        { status: 502 }
      );
    }

    if (!response.ok) {
      const errorData = data as { error?: string };
      return NextResponse.json<ApiErrorResponse>(
        { error: errorData.error || 'Failed to generate brief' },
        { status: response.status }
      );
    }

    return NextResponse.json<BriefResponse>(data as BriefResponse);
  } catch (error) {
    console.error('Failed to generate brief:', error);

    const isTimeout = error instanceof Error && error.message.includes('timed out');
    if (isTimeout) {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Brief generation timed out. Please try again.' },
        { status: 504 }
      );
    }

    return NextResponse.json<ApiErrorResponse>(
      { error: 'Failed to generate brief' },
      { status: 500 }
    );
  }
}
