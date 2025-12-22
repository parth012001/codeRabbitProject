"use client";

import { useUser } from "@clerk/nextjs";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  checkGmailConnection,
  initiateGmailConnection,
  redirectToGmailAuth,
  sendMessageToEmailManager,
  ApiError,
} from "@/lib/api";

function DashboardContent() {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);

  // Track if we've already handled the OAuth success to prevent duplicate state updates
  const oauthSuccessHandledRef = useRef(false);

  // Handle OAuth callback parameters
  useEffect(() => {
    const gmailConnectedParam = searchParams.get("gmail_connected");
    const gmailErrorParam = searchParams.get("gmail_error");

    if (gmailConnectedParam === "true" && !oauthSuccessHandledRef.current) {
      oauthSuccessHandledRef.current = true;
      setGmailConnected(true);
      setGmailError(null);
    }

    if (gmailErrorParam) {
      setGmailError(`Gmail connection failed: ${decodeURIComponent(gmailErrorParam)}`);
    }
  }, [searchParams]);

  // Check Gmail connection status on load - always trust server state
  useEffect(() => {
    if (!user?.id) return;

    const fetchConnectionStatus = async () => {
      try {
        const status = await checkGmailConnection();
        setGmailConnected(status.connected);
      } catch (error) {
        console.error("Failed to check Gmail connection:", error);
        setGmailConnected(false);
      }
    };

    fetchConnectionStatus();
  }, [user?.id]);

  const connectGmail = async () => {
    setConnecting(true);
    setGmailError(null);
    try {
      const { redirectUrl } = await initiateGmailConnection();
      redirectToGmailAuth(redirectUrl);
    } catch (error) {
      console.error("Failed to initiate Gmail connection:", error);
      const message =
        error instanceof ApiError
          ? error.message
          : "Network error. Please check your connection and try again.";
      setGmailError(message);
      setConnecting(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !user?.id) return;

    setLoading(true);
    try {
      const data = await sendMessageToEmailManager(user.id, message);
      setResponse(data.text || JSON.stringify(data, null, 2));
    } catch (error) {
      const errorMessage =
        error instanceof ApiError
          ? `Error: ${error.message}`
          : "Error: Failed to connect to Mastra API";
      setResponse(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">
          Welcome, {user?.firstName || "User"}!
        </h2>
        {/* Only show user ID in development for debugging */}
        {process.env.NODE_ENV !== "production" && (
          <p className="text-gray-600 text-sm">
            User ID: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{user?.id}</code>
          </p>
        )}
      </div>

      {/* Gmail Connection Status */}
      <div className="border rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Gmail Connection</h3>
            <p className="text-gray-600 text-sm mt-1">
              {gmailConnected === null
                ? "Checking connection..."
                : gmailConnected
                ? "Your Gmail account is connected"
                : "Connect your Gmail to get started"}
            </p>
          </div>
          <div>
            {gmailConnected === null ? (
              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                Checking...
              </span>
            ) : gmailConnected ? (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                Connected
              </span>
            ) : (
              <button
                type="button"
                onClick={connectGmail}
                disabled={connecting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
              >
                {connecting ? "Connecting..." : "Connect Gmail"}
              </button>
            )}
          </div>
        </div>
        {/* Error display for Gmail connection */}
        {gmailError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center justify-between">
              <p className="text-red-700 text-sm">{gmailError}</p>
              <button
                type="button"
                onClick={() => setGmailError(null)}
                className="text-red-500 hover:text-red-700 text-sm ml-4"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Chat Interface */}
      <div className="border rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Chat with Email Assistant</h3>

        <div className="space-y-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              gmailConnected
                ? "Ask about your emails... (e.g., 'Show my unread emails')"
                : "Connect Gmail first to interact with your emails"
            }
            disabled={!gmailConnected}
            className="w-full p-3 border rounded-md h-24 resize-none disabled:bg-gray-50 disabled:text-gray-400"
          />

          <button
            type="button"
            onClick={sendMessage}
            disabled={loading || !message.trim() || !gmailConnected}
            className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 disabled:bg-gray-400"
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </div>

        {response && (
          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <h4 className="font-medium mb-2">Response:</h4>
            <p className="whitespace-pre-wrap text-gray-700">{response}</p>
          </div>
        )}
      </div>

      {/* Only show API URL in development */}
      {process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_MASTRA_API_URL && (
        <div className="text-sm text-gray-500">
          <p>Connected to Mastra AI backend at:</p>
          <code className="bg-gray-100 px-2 py-1 rounded text-xs">
            {process.env.NEXT_PUBLIC_MASTRA_API_URL}
          </code>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[80vh]">
          <p>Loading...</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
