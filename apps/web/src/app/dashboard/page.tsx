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
  ApiError,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { UserSettings } from "@email-assistant/types";

function DashboardContent() {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();

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

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Welcome Header */}
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">
              Welcome, {user?.firstName || "User"}!
            </h2>
            {process.env.NODE_ENV !== "production" && (
              <p className="text-slate-500 text-sm flex items-center gap-2">
                User ID:{" "}
                <code className="bg-gradient-to-r from-blue-100 via-purple-100 to-pink-100 px-3 py-1 rounded-full text-xs font-medium text-slate-600">
                  {user?.id}
                </code>
              </p>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => setShowSettings(!showSettings)}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-slate-900 mb-6">Settings</h3>
              {settingsLoading ? (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                  <p className="text-slate-500">Loading settings...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Calendly URL</label>
                    <input
                      type="url"
                      value={calendlyUrl}
                      onChange={(e) => setCalendlyUrl(e.target.value)}
                      placeholder="https://calendly.com/your-link"
                      className="w-full p-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-all duration-300"
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      Used as fallback when you are not available
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Work Hours Start</label>
                      <select
                        value={workingHoursStart}
                        onChange={(e) => setWorkingHoursStart(Number(e.target.value))}
                        className="w-full p-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-all duration-300"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>
                            {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Work Hours End</label>
                      <select
                        value={workingHoursEnd}
                        onChange={(e) => setWorkingHoursEnd(Number(e.target.value))}
                        className="w-full p-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-all duration-300"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>
                            {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="calendarEnabled"
                      checked={calendarEnabled}
                      onChange={(e) => setCalendarEnabled(e.target.checked)}
                      className="w-5 h-5 rounded border-blue-200/50 text-blue-600 focus:ring-blue-500/50"
                    />
                    <label htmlFor="calendarEnabled" className="text-sm text-slate-600">
                      Enable smart meeting detection (requires Calendar connection)
                    </label>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="primary"
                      onClick={saveSettings}
                      loading={settingsSaving}
                    >
                      {settingsSaving ? "Saving..." : "Save Settings"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowSettings(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Gmail Connection */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Gmail</h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {gmailConnected === null
                      ? "Checking connection status..."
                      : gmailConnected
                      ? "Your Gmail is connected"
                      : "Connect to manage emails"}
                  </p>
                </div>
              </div>
              <div>
                {gmailConnected === null ? (
                  <span className="px-4 py-2 bg-slate-100 text-slate-500 rounded-full text-sm font-medium">
                    Checking...
                  </span>
                ) : gmailConnected ? (
                  <span className="px-4 py-2 bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 rounded-full text-sm font-medium">
                    Connected
                  </span>
                ) : (
                  <Button
                    variant="primary"
                    onClick={connectGmail}
                    loading={gmailConnecting}
                  >
                    {gmailConnecting ? "Connecting..." : "Connect"}
                  </Button>
                )}
              </div>
            </div>
            {gmailError && (
              <div className="mt-4 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl text-red-700 text-sm flex justify-between items-center">
                <span>{gmailError}</span>
                <Button variant="ghost" size="sm" onClick={() => setGmailError(null)}>
                  Dismiss
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendar Connection */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Google Calendar</h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {calendarConnected === null
                      ? "Checking connection status..."
                      : calendarConnected
                      ? "Your calendar is connected"
                      : "Connect for smart meeting replies"}
                  </p>
                </div>
              </div>
              <div>
                {calendarConnected === null ? (
                  <span className="px-4 py-2 bg-slate-100 text-slate-500 rounded-full text-sm font-medium">
                    Checking...
                  </span>
                ) : calendarConnected ? (
                  <span className="px-4 py-2 bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 rounded-full text-sm font-medium">
                    Connected
                  </span>
                ) : (
                  <Button
                    variant="primary"
                    onClick={connectCalendar}
                    loading={calendarConnecting}
                  >
                    {calendarConnecting ? "Connecting..." : "Connect"}
                  </Button>
                )}
              </div>
            </div>
            {calendarError && (
              <div className="mt-4 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl text-red-700 text-sm flex justify-between items-center">
                <span>{calendarError}</span>
                <Button variant="ghost" size="sm" onClick={() => setCalendarError(null)}>
                  Dismiss
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-slate-500 font-medium">Loading...</p>
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
