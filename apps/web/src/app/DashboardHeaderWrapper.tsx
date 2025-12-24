'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Image from 'next/image';

interface DashboardHeaderWrapperProps {
  children: React.ReactNode;
}

export function DashboardHeaderWrapper({ children }: DashboardHeaderWrapperProps) {
  const pathname = usePathname();
  const { isLoaded } = useAuth();

  // Hide the dashboard header on the landing page (root path)
  // The landing page has its own header
  if (pathname === '/') {
    return null;
  }

  // Show skeleton header while auth is loading to prevent flash of Sign In/Sign Up buttons
  // This fixes the race condition where SignedOut/SignedIn components render incorrectly
  // before Clerk's auth state is fully hydrated after navigation
  if (!isLoaded) {
    return (
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Noa Logo"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Noa
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Skeleton placeholder for auth buttons - matches UserButton size */}
            <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
          </div>
        </div>
      </header>
    );
  }

  return <>{children}</>;
}
