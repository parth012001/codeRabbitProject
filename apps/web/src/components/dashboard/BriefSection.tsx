'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getBrief, ApiError } from '@/lib/api';
import type { Brief, ProcessedEmail } from '@email-assistant/types';

type BriefState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Extract sender name from email "from" field
 * Handles formats like "John Doe <john@example.com>" and "john@example.com"
 */
function extractSenderName(from: string): string {
  const match = from.match(/^([^<]+)</);
  if (match) {
    return match[1].trim();
  }
  const emailMatch = from.match(/([^@]+)@/);
  if (emailMatch) {
    return emailMatch[1];
  }
  return from;
}

/**
 * Format relative time from ISO string
 */
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

interface StatCardProps {
  label: string;
  value: number;
  colorClass: string;
}

function StatCard({ label, value, colorClass }: StatCardProps) {
  return (
    <div className={`${colorClass} rounded-xl p-4 text-center`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

interface MeetingEmailItemProps {
  email: ProcessedEmail;
}

function MeetingEmailItem({ email }: MeetingEmailItemProps) {
  const statusConfig = {
    available: {
      label: 'Available',
      className: 'bg-green-100 text-green-700',
    },
    busy: {
      label: 'Busy',
      className: 'bg-red-100 text-red-700',
    },
    unknown: {
      label: 'Unknown',
      className: 'bg-slate-100 text-slate-600',
    },
  };

  const status = statusConfig[email.availabilityStatus];

  return (
    <div className="flex items-center gap-3 py-2">
      <span className={`px-2 py-1 ${status.className} text-xs font-medium rounded-full whitespace-nowrap`}>
        {status.label}
      </span>
      <span className="font-medium text-slate-900 truncate">
        {extractSenderName(email.from)}
      </span>
      <span className="text-slate-500 truncate flex-1">
        {email.subject || '(no subject)'}
      </span>
    </div>
  );
}

interface EmailListItemProps {
  email: ProcessedEmail;
  isExpanded: boolean;
  onToggle: () => void;
}

function EmailListItem({ email, isExpanded, onToggle }: EmailListItemProps) {
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full py-3 flex items-center gap-2 text-left hover:bg-slate-50/50 transition-colors rounded-lg px-2 -mx-2"
      >
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-medium text-slate-900 truncate">
          {extractSenderName(email.from)}
        </span>
        <span className="text-slate-500 truncate flex-1">
          {email.subject || '(no subject)'}
        </span>
        {email.isUrgent && (
          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
            Urgent
          </span>
        )}
      </button>
      <AnimatePresence>
        {isExpanded && email.snippet && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="text-sm text-slate-600 pl-8 pb-3 pr-2">
              {email.snippet}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface BriefSectionProps {
  gmailConnected?: boolean | null;
}

export function BriefSection({ gmailConnected }: BriefSectionProps) {
  const [briefState, setBriefState] = useState<BriefState>('idle');
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);

  const handleBriefMe = async () => {
    setBriefState('loading');
    setError(null);

    try {
      const response = await getBrief();
      if (response.success && response.brief) {
        setBrief(response.brief);
        setBriefState('success');
      } else {
        setError(response.error || 'Failed to generate brief');
        setBriefState('error');
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Network error. Please try again.';
      setError(message);
      setBriefState('error');
    }
  };

  const handleDismissError = () => {
    setError(null);
    setBriefState('idle');
  };

  const toggleEmailExpand = (emailId: string) => {
    setExpandedEmailId((current) => (current === emailId ? null : emailId));
  };

  // Idle State
  if (briefState === 'idle') {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Your Daily Brief</h3>
            <p className="text-slate-500 mb-6 max-w-md">
              Get an AI-powered summary of your recent emails, meeting requests, and action items.
            </p>
            {gmailConnected === false ? (
              <p className="text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-xl">
                Connect Gmail first to generate your brief
              </p>
            ) : (
              <Button variant="primary" onClick={handleBriefMe}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
                Brief me
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading State
  if (briefState === 'loading') {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center py-8">
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Generating your brief...</h3>
            <p className="text-sm text-slate-500">Analyzing your inbox and drafting insights.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error State
  if (briefState === 'error') {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Failed to generate brief</h3>
            <p className="text-sm text-slate-500 mb-4">{error}</p>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={handleDismissError}>
                Dismiss
              </Button>
              <Button variant="primary" onClick={handleBriefMe}>
                Try Again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Success State
  if (briefState === 'success' && brief) {
    const hasMeetings =
      brief.meetingBreakdown.available.length > 0 ||
      brief.meetingBreakdown.busy.length > 0 ||
      brief.meetingBreakdown.unknown.length > 0;

    const allMeetingEmails = [
      ...brief.meetingBreakdown.available,
      ...brief.meetingBreakdown.busy,
      ...brief.meetingBreakdown.unknown,
    ];

    // Non-meeting emails for the "Recent Emails" section
    const nonMeetingEmails = brief.emails.filter((e) => !e.isMeetingRequest);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="mb-6">
          <CardContent className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Your Brief</h3>
                  <p className="text-sm text-slate-500">Generated {formatRelativeTime(brief.generatedAt)}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleBriefMe}>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </Button>
            </div>

            {/* AI Summary */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-6">
              <p className="text-slate-700 leading-relaxed">{brief.summary}</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <StatCard
                label="Total"
                value={brief.stats.total}
                colorClass="bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600"
              />
              <StatCard
                label="Meetings"
                value={brief.stats.meetings}
                colorClass="bg-gradient-to-br from-purple-50 to-purple-100 text-purple-600"
              />
              <StatCard
                label="Urgent"
                value={brief.stats.urgent}
                colorClass="bg-gradient-to-br from-red-50 to-red-100 text-red-600"
              />
              <StatCard
                label="Drafts Ready"
                value={brief.draftsReady}
                colorClass="bg-gradient-to-br from-green-50 to-green-100 text-green-600"
              />
            </div>

            {/* Meetings Section */}
            {hasMeetings && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
                  Meeting Requests
                </h4>
                <div className="space-y-1">
                  {allMeetingEmails.map((email) => (
                    <MeetingEmailItem key={email.id} email={email} />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Emails Section */}
            {nonMeetingEmails.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
                  Recent Emails
                </h4>
                <div>
                  {nonMeetingEmails.map((email) => (
                    <EmailListItem
                      key={email.id}
                      email={email}
                      isExpanded={expandedEmailId === email.id}
                      onToggle={() => toggleEmailExpand(email.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {brief.stats.total === 0 && (
              <div className="text-center py-4">
                <p className="text-slate-500">No emails in the last 24 hours.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return null;
}
