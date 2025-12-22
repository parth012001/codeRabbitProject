import type { ApiErrorResponse } from '@email-assistant/types';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface FetchOptions extends RequestInit {
  timeout?: number;
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new ApiError('Request timed out', 408));
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

export async function apiRequest<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { timeout = 30000, ...fetchOptions } = options;

  const fetchPromise = fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  });

  const response = await withTimeout(fetchPromise, timeout);

  if (!response.ok) {
    let errorData: ApiErrorResponse | null = null;
    try {
      errorData = await response.json();
    } catch {
      // Response wasn't JSON
    }

    throw new ApiError(
      errorData?.error || `Request failed with status ${response.status}`,
      response.status,
      errorData?.code,
      errorData?.details
    );
  }

  return response.json();
}

export function getMastraApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_MASTRA_API_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_MASTRA_API_URL is not configured');
  }
  return url;
}
