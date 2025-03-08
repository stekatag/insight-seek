import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Truncates text to a specified length and adds an ellipsis if needed
 *
 * @param text The text to truncate
 * @param maxLength Maximum character length before truncation
 * @param addEllipsis Whether to add ellipsis to truncated text
 * @returns Truncated text string
 */
export function truncateText(
  text: string,
  maxLength: number,
  addEllipsis = true,
): string {
  if (!text || text.length <= maxLength) {
    return text;
  }

  // Find a good breaking point (e.g., space, comma, etc.)
  let truncateIndex = maxLength;
  const breakChars = [" ", ",", ";", ".", ":", "-", "/"];

  // Look for a good breaking point starting from maxLength and going backwards
  for (let i = maxLength; i > maxLength - 20 && i > 0; i--) {
    const char = text[i];
    if (char && breakChars.includes(char)) {
      truncateIndex = i;
      break;
    }
  }

  return text.substring(0, truncateIndex) + (addEllipsis ? "..." : "");
}

/**
 * Formats text containing file paths or long technical references to make them breakable
 * in HTML without overflowing containers
 *
 * @param text The text to format
 * @param maxLength Optional length to truncate first (0 means no truncation)
 * @returns Formatted text with zero-width spaces inserted at appropriate break points
 */
export function formatTechnicalText(
  text: string,
  maxLength: number = 0,
): string {
  if (!text) return "Text unavailable";

  // Truncate if needed
  if (maxLength > 0 && text.length > maxLength) {
    text = truncateText(text, maxLength);
  }

  return (
    text
      // Add zero-width spaces after punctuation in file paths
      .replace(/\//g, "/\u200B")
      .replace(/\./g, ".\u200B")
      .replace(/\-/g, "-\u200B")
      .replace(/\_/g, "_\u200B")
      // Add breaks after brackets and parentheses
      .replace(/\[/g, "[\u200B")
      .replace(/\]/g, "]\u200B")
      .replace(/\(/g, "(\u200B")
      .replace(/\)/g, ")\u200B")
      // Add breaks after common separators in technical text
      .replace(/,/g, ",\u200B")
      .replace(/:/g, ":\u200B")
  );
}

/**
 * Predefined truncation limits for different content types
 */
export const TRUNCATION_LIMITS = {
  COMMIT_MESSAGE: 120,
  PROJECT_NAME: 30,
  QUESTION: 60,
  MEETING_NAME: 40,
  SEARCH_RESULT: 70,
};
