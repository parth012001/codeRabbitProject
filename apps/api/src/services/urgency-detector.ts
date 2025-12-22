/**
 * Urgency Detector Service
 * Detects urgent emails using regex patterns for common urgent keywords
 */

/**
 * Regex patterns for detecting urgency in emails
 * These patterns match common urgent keywords and phrases
 */
const URGENT_PATTERNS: RegExp[] = [
  /\bASAP\b/i,
  /\burgent(ly)?\b/i,
  /\bimmediate(ly)?\b/i,
  /\btime[- ]?sensitive\b/i,
  /\bhigh[- ]?priority\b/i,
  /\bpriority\b/i,
  /\bdeadline\b/i,
  /\bcritical\b/i,
  /\bemergency\b/i,
  /\baction required\b/i,
  /\brespond (by|before|today)\b/i,
  /\bneeds? (immediate|urgent)\b/i,
  /\btoday\b.*\b(by|before|need)\b/i,
  /\b(need|require)s? (your )?(immediate|urgent)\b/i,
  /\bdon'?t delay\b/i,
  /\btime is (running out|critical)\b/i,
];

/**
 * Detect if an email is urgent based on subject and body content
 * Uses regex pattern matching for common urgent keywords
 *
 * @param subject - Email subject line
 * @param body - Email body content
 * @returns true if email appears urgent, false otherwise
 */
export function detectUrgency(subject: string, body: string): boolean {
  // Combine subject and body for matching
  // Subject is weighted more heavily by checking it separately first
  const subjectMatch = URGENT_PATTERNS.some((pattern) => pattern.test(subject));
  if (subjectMatch) {
    return true;
  }

  // Check body content
  const bodyMatch = URGENT_PATTERNS.some((pattern) => pattern.test(body));
  return bodyMatch;
}

/**
 * Get which urgent patterns matched (for debugging/logging)
 *
 * @param subject - Email subject line
 * @param body - Email body content
 * @returns Array of matched pattern strings
 */
export function getMatchedUrgencyPatterns(subject: string, body: string): string[] {
  const text = `${subject} ${body}`;
  return URGENT_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}
