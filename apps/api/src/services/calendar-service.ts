import {
  composio,
  checkCalendarConnection,
  CALENDAR_ACTIONS,
} from './composio.js';

// ============================================================================
// Types
// ============================================================================

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  isAllDay: boolean;
}

export interface TimeSlot {
  start: string; // ISO datetime
  end: string; // ISO datetime
}

export interface AvailabilityResult {
  isConnected: boolean;
  isAvailable: boolean;
  conflictingEvents: CalendarEvent[];
  availableSlots: TimeSlot[];
  error?: string;
}

interface CalendarListEventsResponse {
  items?: Array<{
    id?: string;
    summary?: string;
    start?: {
      dateTime?: string;
      date?: string;
    };
    end?: {
      dateTime?: string;
      date?: string;
    };
  }>;
}

// ============================================================================
// Helpers
// ============================================================================

/** Raw event type from Composio response */
type RawCalendarEvent = NonNullable<CalendarListEventsResponse['items']>[number];

/**
 * Parse event from Composio response to our CalendarEvent type
 */
function parseEvent(rawEvent: RawCalendarEvent): CalendarEvent | null {
  if (!rawEvent.id) return null;

  const startDateTime = rawEvent.start?.dateTime || rawEvent.start?.date;
  const endDateTime = rawEvent.end?.dateTime || rawEvent.end?.date;

  if (!startDateTime || !endDateTime) return null;

  return {
    id: rawEvent.id,
    summary: rawEvent.summary || '(No title)',
    start: startDateTime,
    end: endDateTime,
    isAllDay: !rawEvent.start?.dateTime, // If no dateTime, it's an all-day event
  };
}

/**
 * Check if two time ranges overlap
 */
function timeRangesOverlap(
  range1Start: Date,
  range1End: Date,
  range2Start: Date,
  range2End: Date
): boolean {
  return range1Start < range2End && range1End > range2Start;
}

/**
 * Create ISO datetime string from date
 */
function toISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Get start and end of a day in user's context
 * @param date - The date to get bounds for
 * @param offsetDays - Days to add to the date
 */
function getDayBounds(date: Date, offsetDays: number = 0): { start: Date; end: Date } {
  const start = new Date(date);
  start.setDate(start.getDate() + offsetDays);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Fetch calendar events for a user within a time range
 * @param userId - Clerk user ID
 * @param timeMin - Start of time range (ISO string)
 * @param timeMax - End of time range (ISO string)
 * @returns List of calendar events
 */
export async function getCalendarEvents(
  userId: string,
  timeMin: string,
  timeMax: string
): Promise<{ events: CalendarEvent[]; error?: string }> {
  try {
    // Check connection first
    const connection = await checkCalendarConnection(userId);
    if (!connection.connected) {
      return { events: [], error: 'Google Calendar not connected' };
    }

    console.log(`[Calendar] Fetching events for user from ${timeMin} to ${timeMax}`);

    const result = await composio.tools.execute(CALENDAR_ACTIONS.LIST_EVENTS, {
      userId,
      arguments: {
        calendarId: 'primary',
        timeMin: timeMin,
        timeMax: timeMax,
        singleEvents: true, // Expand recurring events
        orderBy: 'startTime',
        maxResults: 50,
      },
    });

    if (!result.successful) {
      console.error('[Calendar] Failed to fetch events:', result.error);
      return { events: [], error: result.error || 'Failed to fetch events' };
    }

    const data = result.data as CalendarListEventsResponse;
    const events: CalendarEvent[] = [];

    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        const event = parseEvent(item);
        if (event) {
          events.push(event);
        }
      }
    }

    console.log(`[Calendar] Found ${events.length} events`);
    return { events };
  } catch (error) {
    console.error('[Calendar] Error fetching events:', error);
    return {
      events: [],
      error: error instanceof Error ? error.message : 'Unknown error fetching events',
    };
  }
}

/** Response type for FreeBusy query */
interface FreeBusyResponse {
  calendars?: {
    [calendarId: string]: {
      busy?: Array<{
        start: string;
        end: string;
      }>;
      errors?: Array<{
        domain: string;
        reason: string;
      }>;
    };
  };
}

/**
 * Check if a user is available at a specific time slot using FreeBusy query
 * @param userId - Clerk user ID
 * @param proposedStart - Proposed meeting start time (ISO string)
 * @param proposedEnd - Proposed meeting end time (ISO string)
 * @returns Availability result with busy periods if any
 */
export async function checkAvailability(
  userId: string,
  proposedStart: string,
  proposedEnd: string
): Promise<AvailabilityResult> {
  try {
    // Check connection first
    const connection = await checkCalendarConnection(userId);
    if (!connection.connected) {
      return {
        isConnected: false,
        isAvailable: false,
        conflictingEvents: [],
        availableSlots: [],
        error: 'Google Calendar not connected',
      };
    }

    console.log(`[Calendar] Checking free/busy from ${proposedStart} to ${proposedEnd}`);

    // DEBUG: List available calendar tools - just the names
    try {
      const { GCAL_AUTH_CONFIG_ID } = await import('./composio.js');
      const toolsByAuth = await composio.tools.get(userId, {
        authConfigIds: [GCAL_AUTH_CONFIG_ID]
      });
      const toolNames = Object.keys(toolsByAuth);
      console.log(`[Calendar] Available GOOGLECALENDAR tools (${toolNames.length}):`, toolNames);

      // Look for freebusy-related tools
      const freebusyTools = toolNames.filter(name =>
        name.toLowerCase().includes('free') ||
        name.toLowerCase().includes('busy') ||
        name.toLowerCase().includes('availability')
      );
      console.log(`[Calendar] FreeBusy-related tools:`, freebusyTools);
    } catch (toolsError) {
      console.error('[Calendar] Failed to list available tools:', toolsError);
    }

    // Use FreeBusy query - the proper way to check availability
    // Google Calendar API uses camelCase parameters
    const result = await composio.tools.execute(CALENDAR_ACTIONS.FREEBUSY_QUERY, {
      userId,
      arguments: {
        timeMin: proposedStart,
        timeMax: proposedEnd,
        items: [{ id: 'primary' }],
      },
    });

    if (!result.successful) {
      console.error('[Calendar] FreeBusy query failed:', result.error);
      console.error('[Calendar] Full result:', JSON.stringify(result, null, 2));
      return {
        isConnected: true,
        isAvailable: false,
        conflictingEvents: [],
        availableSlots: [],
        error: result.error || 'Failed to check availability',
      };
    }

    const data = result.data as FreeBusyResponse;
    console.log('[Calendar] FreeBusy response:', JSON.stringify(data, null, 2));

    // Check if primary calendar has busy periods
    // Note: Google Calendar FreeBusy API returns the calendar keyed by the actual email address,
    // not "primary". We need to find the first calendar in the response.
    let primaryCalendar: { busy?: Array<{ start: string; end: string }>; errors?: Array<{ domain: string; reason: string }> } | undefined;

    if (data.calendars) {
      // First try explicit keys
      primaryCalendar = data.calendars['primary'] || data.calendars['primary@gmail.com'];

      // If not found, get the first calendar in the response (which is the user's actual email)
      if (!primaryCalendar) {
        const calendarKeys = Object.keys(data.calendars);
        console.log('[Calendar] Available calendar keys:', calendarKeys);
        if (calendarKeys.length > 0) {
          primaryCalendar = data.calendars[calendarKeys[0]];
          console.log(`[Calendar] Using calendar key: ${calendarKeys[0]}`);
        }
      }
    }

    const busyPeriods = primaryCalendar?.busy || [];

    // Convert busy periods to conflicting events format
    const conflictingEvents: CalendarEvent[] = busyPeriods.map((busy, index) => ({
      id: `busy-${index}`,
      summary: 'Busy',
      start: busy.start,
      end: busy.end,
      isAllDay: false,
    }));

    const isAvailable = busyPeriods.length === 0;

    console.log(
      `[Calendar] Availability check: ${isAvailable ? 'AVAILABLE' : 'BUSY'} (${busyPeriods.length} busy periods)`
    );

    return {
      isConnected: true,
      isAvailable,
      conflictingEvents,
      availableSlots: [],
    };
  } catch (error) {
    console.error('[Calendar] Error checking availability:', error);
    return {
      isConnected: true,
      isAvailable: false,
      conflictingEvents: [],
      availableSlots: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get available time slots for a user on a specific day using FreeBusy query
 * @param userId - Clerk user ID
 * @param date - The date to check availability for
 * @param slotDurationMinutes - Duration of each slot in minutes (default: 30)
 * @param workingHoursStart - Start of working hours (default: 9)
 * @param workingHoursEnd - End of working hours (default: 17)
 * @returns List of available time slots
 */
export async function getAvailableSlots(
  userId: string,
  date: Date,
  slotDurationMinutes: number = 30,
  workingHoursStart: number = 9,
  workingHoursEnd: number = 17
): Promise<{ slots: TimeSlot[]; error?: string }> {
  try {
    // Check connection first
    const connection = await checkCalendarConnection(userId);
    if (!connection.connected) {
      return { slots: [], error: 'Google Calendar not connected' };
    }

    // Create working hours bounds for the day
    const workStart = new Date(date);
    workStart.setHours(workingHoursStart, 0, 0, 0);

    const workEnd = new Date(date);
    workEnd.setHours(workingHoursEnd, 0, 0, 0);

    // Use FreeBusy query to get busy periods for the day
    // Google Calendar API uses camelCase parameters
    const result = await composio.tools.execute(CALENDAR_ACTIONS.FREEBUSY_QUERY, {
      userId,
      arguments: {
        timeMin: toISOString(workStart),
        timeMax: toISOString(workEnd),
        items: [{ id: 'primary' }],
      },
    });

    if (!result.successful) {
      console.error('[Calendar] FreeBusy query failed for slots:', result.error);
      return { slots: [], error: result.error || 'Failed to get available slots' };
    }

    const data = result.data as FreeBusyResponse;

    // Find the calendar data - Google returns it keyed by actual email, not "primary"
    let primaryCalendar: { busy?: Array<{ start: string; end: string }> } | undefined;
    if (data.calendars) {
      primaryCalendar = data.calendars['primary'] || data.calendars['primary@gmail.com'];
      if (!primaryCalendar) {
        const calendarKeys = Object.keys(data.calendars);
        if (calendarKeys.length > 0) {
          primaryCalendar = data.calendars[calendarKeys[0]];
        }
      }
    }
    const busyPeriods = primaryCalendar?.busy || [];

    // Generate all possible slots and filter out busy ones
    const slots: TimeSlot[] = [];
    const slotDurationMs = slotDurationMinutes * 60 * 1000;

    let currentSlotStart = workStart.getTime();
    while (currentSlotStart + slotDurationMs <= workEnd.getTime()) {
      const slotStart = new Date(currentSlotStart);
      const slotEnd = new Date(currentSlotStart + slotDurationMs);

      // Check if this slot conflicts with any busy period
      let hasConflict = false;
      for (const busy of busyPeriods) {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);

        if (timeRangesOverlap(slotStart, slotEnd, busyStart, busyEnd)) {
          hasConflict = true;
          break;
        }
      }

      if (!hasConflict) {
        slots.push({
          start: toISOString(slotStart),
          end: toISOString(slotEnd),
        });
      }

      currentSlotStart += slotDurationMs;
    }

    console.log(`[Calendar] Found ${slots.length} available slots on ${date.toDateString()}`);
    return { slots };
  } catch (error) {
    console.error('[Calendar] Error getting available slots:', error);
    return {
      slots: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check availability for the next N days and return summary
 * @param userId - Clerk user ID
 * @param daysAhead - Number of days to check (default: 7)
 * @returns Summary of availability
 */
export async function getAvailabilitySummary(
  userId: string,
  daysAhead: number = 7
): Promise<{
  isConnected: boolean;
  summary: Array<{ date: string; availableSlots: number; totalSlots: number }>;
  error?: string;
}> {
  try {
    const connection = await checkCalendarConnection(userId);
    if (!connection.connected) {
      return {
        isConnected: false,
        summary: [],
        error: 'Google Calendar not connected',
      };
    }

    const summary: Array<{ date: string; availableSlots: number; totalSlots: number }> = [];
    const today = new Date();

    for (let i = 0; i < daysAhead; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + i);

      // Skip weekends
      const dayOfWeek = checkDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const { slots } = await getAvailableSlots(userId, checkDate);

      // Calculate total possible slots (8 hours * 2 slots per hour = 16 slots for 30-min slots)
      const totalSlots = 16;

      summary.push({
        date: checkDate.toISOString().split('T')[0],
        availableSlots: slots.length,
        totalSlots,
      });
    }

    return {
      isConnected: true,
      summary,
    };
  } catch (error) {
    console.error('[Calendar] Error getting availability summary:', error);
    return {
      isConnected: true,
      summary: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
