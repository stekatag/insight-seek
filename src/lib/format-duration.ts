/**
 * Formats start and end time values into a human-readable duration string
 * Expects input in format "HH:MM:SS" or similar
 */
export function formatDuration(startTime: string, endTime: string): string {
  try {
    // Add leading zero for times like "1:20" to make it "01:20"
    const padTimeString = (time: string): string => {
      const parts = time.split(":");
      if (parts.length === 2) {
        return parts.map((p) => p.padStart(2, "0")).join(":");
      }
      return parts.map((p) => p.padStart(2, "0")).join(":");
    };

    const start = padTimeString(startTime);
    const end = padTimeString(endTime);

    // Format with nicer duration display
    return `${start} - ${end}`;
  } catch (error) {
    // Return original values if any parsing error occurs
    return `${startTime} - ${endTime}`;
  }
}
