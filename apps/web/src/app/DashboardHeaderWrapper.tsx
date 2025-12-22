'use client';

import { usePathname } from 'next/navigation';

interface DashboardHeaderWrapperProps {
  children: React.ReactNode;
}

export function DashboardHeaderWrapper({ children }: DashboardHeaderWrapperProps) {
  const pathname = usePathname();

  // Hide the dashboard header on the landing page (root path)
  // The landing page has its own header
  if (pathname === '/') {
    return null;
  }

  return <>{children}</>;
}
