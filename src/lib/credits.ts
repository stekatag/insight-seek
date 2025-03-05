/**
 * Calculate credits needed for a meeting based on its duration in minutes
 * @param durationMinutes - Duration of the meeting in minutes
 */
export function calculateMeetingCredits(durationMinutes: number): number {
  // Base rate: 100 credits for 40 minutes
  const baseRate = 2.5; // Credits per minute
  const minCredits = 10; // Minimum credits for very short meetings

  const calculatedCredits = Math.ceil(durationMinutes * baseRate);

  // Ensure we charge at least the minimum amount
  return Math.max(calculatedCredits, minCredits);
}

/**
 * Format meeting duration from seconds to a human-readable string
 * @param durationSeconds - Duration in seconds
 */
export function formatMeetingDuration(durationSeconds: number): string {
  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = Math.floor(durationSeconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Get duration in minutes rounded up to the nearest minute
 * @param durationSeconds - Duration in seconds
 */
export function getDurationMinutes(durationSeconds: number): number {
  return Math.ceil(durationSeconds / 60);
}
