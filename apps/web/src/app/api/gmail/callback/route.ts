import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Server-controlled base URL
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3001';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const baseUrl = getBaseUrl();

  // Check for OAuth error parameters
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) {
    console.error('Gmail OAuth error:', error, errorDescription);
    // Redirect to dashboard with error
    return NextResponse.redirect(
      `${baseUrl}/dashboard?gmail_error=${encodeURIComponent(error)}`
    );
  }

  // Verify user is authenticated
  const { userId } = await auth();
  if (!userId) {
    console.error('Gmail callback received without authenticated user');
    return NextResponse.redirect(`${baseUrl}/sign-in`);
  }

  // Composio handles the OAuth token exchange internally via their redirect flow.
  // The state parameter is managed by Composio's OAuth flow - when we call
  // connectedAccounts.initiate(), Composio generates and validates the state.
  // We just redirect back to dashboard with success flag.
  // The dashboard will verify the actual connection status via API.

  // Anonymize userId for logging (PII protection)
  const anonymizedId = userId.length <= 8
    ? `${userId.substring(0, 4)}***`
    : `${userId.substring(0, 4)}...${userId.substring(userId.length - 4)}`;
  console.log(`Gmail OAuth callback completed for user_${anonymizedId}`);

  return NextResponse.redirect(`${baseUrl}/oauth-success?service=gmail`);
}
