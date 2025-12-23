/**
 * Centralized timeout configuration for API requests
 * All values in milliseconds
 */

export const API_TIMEOUTS = {
  /** Default timeout for API requests */
  DEFAULT: 30000,

  /** Quick status check operations */
  STATUS_CHECK: 10000,

  /** OAuth connection initiation */
  CONNECTION: 15000,

  /** AI-powered operations (brief generation, etc.) */
  AI_OPERATION: 15000,

  /** Agent calls that may involve multiple AI operations */
  AGENT: 60000,
} as const;

export type TimeoutKey = keyof typeof API_TIMEOUTS;
