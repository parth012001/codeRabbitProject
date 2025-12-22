"use client";

import { useUser } from "@clerk/nextjs";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  checkGmailConnection,
  initiateGmailConnection,
  redirectToGmailAuth,
  checkCalendarConnection,
  initiateCalendarConnection,
  redirectToCalendarAuth,
  getUserSettings,
  updateUserSettings,
  sendMessageToEmailManager,
  ApiError,
} from "@/lib/api";
import type { UserSettings } from "@email-assistant/types";

function DashboardContent() {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  // Gmail state
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);

  // Calendar state
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);
  const [calendarConnecting, setCalendarConnecting] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  // Settings state
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Form state for settings
  const [calendlyUrl, setCalendlyUrl] = useState("");
  const [workingHoursStart, setWorkingHoursStart] = useState(9);
  const [workingHoursEnd, setWorkingHoursEnd] = useState(17);
  const [calendarEnabled, setCalendarEnabled] = useState(false);

  // Track OAuth success handling independently per service
  const gmailOauthHandledRef = useRef(false);
  const calendarOauthHandledRef = useRef(false);

  // Handle OAuth callback parameters
  useEffect(() => {
    const gmailConnectedParam = searchParams.get("gmail_connected");
    const gmailErrorParam = searchParams.get("gmail_error");
    const calendarConnectedParam = searchParams.get("calendar_connected");
    const calendarErrorParam = searchParams.get("calendar_error");

    if (!gmailOauthHandledRef.current && gmailConnectedParam === "true") {
      gmailOauthHandledRef.current = true;
      setGmailConnected(true);
      setGmailError(null);
    }

    if (!calendarOauthHandledRef.current && calendarConnectedParam === "true") {
      calendarOauthHandledRef.current = true;
      setCalendarConnected(true);
      setCalendarError(null);
    }

    if (gmailErrorParam) {
      setGmailError(`Gmail connection failed: ${decodeURIComponent(gmailErrorParam)}`);
    }
    if (calendarErrorParam) {
      setCalendarError(`Calendar connection failed: ${decodeURIComponent(calendarErrorParam)}`);
    }
  }, [searchParams]);

  // Fetch connection statuses and settings on load
  useEffect(() => {
    if (!user?.id) return;

    const fetchData = async () => {
      // Fetch Gmail status
      try {
        const gmailStatus = await checkGmailConnection();
        setGmailConnected(gmailStatus.connected);
      } catch (error) {
        console.error("Failed to check Gmail connection:", error);
        setGmailConnected(false);
      }

      // Fetch Calendar status
      try {
        const calendarStatus = await checkCalendarConnection();
        setCalendarConnected(calendarStatus.connected);
      } catch (error) {
        console.error("Failed to check Calendar connection:", error);
        setCalendarConnected(false);
      }

      // Fetch settings
      setSettingsLoading(true);
      try {
        const settingsResponse = await getUserSettings();
        if (settingsResponse.success) {
          setSettings(settingsResponse.settings);
          setCalendlyUrl(settingsResponse.settings.calendlyUrl || "");
          setWorkingHoursStart(settingsResponse.settings.workingHoursStart);
          setWorkingHoursEnd(settingsResponse.settings.workingHoursEnd);
          setCalendarEnabled(settingsResponse.settings.calendarEnabled);
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setSettingsLoading(false);
      }
    };

    fetchData();
  }, [user?.id]);

  const connectGmail = async () => {
    setGmailConnecting(true);
    setGmailError(null);
    try {
      const { redirectUrl } = await initiateGmailConnection();
      redirectToGmailAuth(redirectUrl);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Network error";
      setGmailError(message);
      setGmailConnecting(false);
    }
  };

  const connectCalendar = async () => {
    setCalendarConnecting(true);
    setCalendarError(null);
    try {
      const result = await initiateCalendarConnection();
      if (result.alreadyConnected) {
        setCalendarConnected(true);
        setCalendarConnecting(false);
      } else if (result.redirectUrl) {
        redirectToCalendarAuth(result.redirectUrl);
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Network error";
      setCalendarError(message);
      setCalendarConnecting(false);
    }
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      const result = await updateUserSettings({
        calendlyUrl: calendlyUrl || null,
        workingHoursStart,
        workingHoursEnd,
        calendarEnabled,
      });
      if (result.success) {
        setSettings(result.settings);
        setShowSettings(false);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSettingsSaving(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !user?.id) return;

    setLoading(true);
    try {
      const data = await sendMessageToEmailManager(user.id, message);
      setResponse(data.text || JSON.stringify(data, null, 2));
    } catch (error) {
      const errorMessage = error instanceof ApiError
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">
            Welcome, {user?.firstName || "User"}!
          </h2>
          {process.env.NODE_ENV !== "production" && (
            <p className="text-gray-600 text-sm">
              User ID: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{user?.id}</code>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="px-4 py-2 border rounded-md hover:bg-gray-50"
        >
          Settings
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border rounded-lg p-6 mb-6 bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">Settings</h3>
          {settingsLoading ? (
            <p className="text-gray-500">Loading settings...</p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Calendly URL</label>
                <input
                  type="url"
                  value={calendlyUrl}
                  onChange={(e) => setCalendlyUrl(e.target.value)}
                  placeholder="https://calendly.com/your-link"
                  className="w-full p-2 border rounded-md"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Used as fallback when you are not available
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Work Hours Start</label>
                  <select
                    value={workingHoursStart}
                    onChange={(e) => setWorkingHoursStart(Number(e.target.value))}
                    className="w-full p-2 border rounded-md"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Work Hours End</label>
                  <select
                    value={workingHoursEnd}
                    onChange={(e) => setWorkingHoursEnd(Number(e.target.value))}
                    className="w-full p-2 border rounded-md"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="calendarEnabled"
                  checked={calendarEnabled}
                  onChange={(e) => setCalendarEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="calendarEnabled" className="text-sm">
                  Enable smart meeting detection (requires Calendar connection)
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveSettings}
                  disabled={settingsSaving}
                  className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 disabled:bg-gray-400"
                >
                  {settingsSaving ? "Saving..." : "Save Settings"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 border rounded-md hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Gmail Connection */}
      <div className="border rounded-lg p-6 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Gmail</h3>
            <p className="text-gray-600 text-sm mt-1">
              {gmailConnected === null
                ? "Checking..."
                : gmailConnected
                ? "Connected"
                : "Connect to manage emails"}
            </p>
          </div>
          <div>
            {gmailConnected === null ? (
              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">Checking...</span>
            ) : gmailConnected ? (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">Connected</span>
            ) : (
              <button
                type="button"
                onClick={connectGmail}
                disabled={gmailConnecting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
              >
                {gmailConnecting ? "Connecting..." : "Connect"}
              </button>
            )}
          </div>
        </div>
        {gmailError && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex justify-between">
            <span>{gmailError}</span>
            <button type="button" onClick={() => setGmailError(null)} className="text-red-500 hover:text-red-700">
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Calendar Connection */}
      <div className="border rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Google Calendar</h3>
            <p className="text-gray-600 text-sm mt-1">
              {calendarConnected === null
                ? "Checking..."
                : calendarConnected
                ? "Connected"
                : "Connect for smart meeting replies"}
            </p>
          </div>
          <div>
            {calendarConnected === null ? (
              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">Checking...</span>
            ) : calendarConnected ? (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">Connected</span>
            ) : (
              <button
                type="button"
                onClick={connectCalendar}
                disabled={calendarConnecting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
              >
                {calendarConnecting ? "Connecting..." : "Connect"}
              </button>
            )}
          </div>
        </div>
        {calendarError && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex justify-between">
            <span>{calendarError}</span>
            <button type="button" onClick={() => setCalendarError(null)} className="text-red-500 hover:text-red-700">
              Dismiss
            </button>
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
                ? "Ask about your emails..."
                : "Connect Gmail first"
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
