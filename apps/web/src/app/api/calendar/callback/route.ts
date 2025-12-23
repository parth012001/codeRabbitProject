import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/utils/url';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const baseUrl = getBaseUrl();

  // Check for OAuth error parameters
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) {
    console.error('Calendar OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      `${baseUrl}/dashboard?calendar_error=${encodeURIComponent(error)}`
    );
  }

  // Verify user is authenticated
  const { userId } = await auth();
  if (!userId) {
    console.error('Calendar callback received without authenticated user');
    return NextResponse.redirect(`${baseUrl}/sign-in`);
  }

  // Anonymize userId for logging
  const anonymizedId = userId.length <= 8
    ? `${userId.substring(0, 4)}***`
    : `${userId.substring(0, 4)}...${userId.substring(userId.length - 4)}`;
  console.log(`Calendar OAuth callback completed for user_${anonymizedId}`);

  return NextResponse.redirect(`${baseUrl}/oauth-success?service=calendar`);
}
