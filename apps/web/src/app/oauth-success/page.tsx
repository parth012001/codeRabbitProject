"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function OAuthSuccessContent() {
  const searchParams = useSearchParams();
  const service = searchParams.get("service");

  const serviceName = service === "gmail"
    ? "Gmail"
    : service === "calendar"
    ? "Google Calendar"
    : "Service";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md mx-4 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          {serviceName} Connected
        </h1>
        <p className="text-slate-600 mb-6">
          You can close this tab and return to your dashboard.
        </p>
        <p className="text-sm text-slate-400">
          This tab will not redirect automatically.
        </p>
      </div>
    </div>
  );
}

export default function OAuthSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      }
    >
      <OAuthSuccessContent />
    </Suspense>
  );
}
