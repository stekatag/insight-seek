import { clsx, type ClassValue } from "clsx";
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
 * Formats text containing code fragments or long technical references
 * to make them breakable in HTML without overflowing containers
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
      .replace(/\{/g, "{\u200B")
      .replace(/\}/g, "}\u200B")
      // Add breaks after common separators in technical text
      .replace(/,/g, ",\u200B")
      .replace(/:/g, ":\u200B")
      .replace(/;/g, ";\u200B")
      // Handle backticks for code blocks
      .replace(/`/g, "`\u200B")
      // Add breaks in camelCase and PascalCase words (before capital letters)
      .replace(/([a-z])([A-Z])/g, "$1\u200B$2")
      // Add breaks in very long words (every ~10 characters in words longer than 15 chars)
      .replace(/([a-zA-Z]{10})([a-zA-Z])/g, "$1\u200B$2")
  );
}

/**
 * Formats code fragments within text by removing triple backticks and
 * processing inline code with single backticks, properly handling nested bullet points
 *
 * @param text Text from the database that may contain code fragments marked with backticks
 * @returns React components with code fragments properly formatted
 */
export function formatCodeFragments(text: string): React.ReactNode {
  if (!text) return "Text unavailable";

  // Remove the triple backticks that sometimes appear at start/end of summaries
  text = text.replace(/^```\n?/g, "").replace(/```$/g, "");

  // Check for "Text unavailable" that might be incorrectly prepended
  if (text.startsWith("Text unavailable")) {
    text = text.replace("Text unavailable", "").trim();
  }

  // Trim extra whitespace and line breaks at the end
  text = text.replace(/\s+$/, "");

  // Process nested bullet points
  // Look for lines starting with spaces/tabs followed by * to identify nested bullets
  text = text.replace(/^(\s+)\* /gm, (match, spaces) => {
    // Convert indented bullets to use proper indentation with CSS
    const indentLevel = Math.ceil(spaces.length / 2);
    return `* ${"·".repeat(indentLevel)} `;
  });

  // Ensure bullet points (* items) display properly with line breaks
  // Only add line breaks before bullets that don't already have one
  text = text.replace(/([^\n])\s*\*\s+/g, "$1\n* ");

  // If no backticks remain after cleanup, just format the text
  if (!text.includes("`") && !text.includes("[")) {
    return (
      <span style={{ whiteSpace: "pre-line" }}>
        {formatTechnicalText(text)}
      </span>
    );
  }

  // Process text by splitting it into segments while preserving line breaks
  const segments = text
    .split("\n")
    .map((line, lineIndex) => {
      // Check if this is a nested bullet point by looking for the marker we added
      const isNestedBullet = line.match(/^\* (·+) /);
      let processedLine = line;

      if (isNestedBullet && isNestedBullet[1]) {
        // Replace our marker with proper indentation
        const indentLevel = isNestedBullet[1].length;
        processedLine = line.replace(/^\* ·+ /, "");

        // Add proper indentation using CSS
        return (
          <span
            key={`line-${lineIndex}`}
            className="block"
            style={{
              paddingLeft: `${indentLevel * 1.5}rem`,
              position: "relative",
            }}
          >
            <span
              className="absolute left-2"
              style={{ marginLeft: `${(indentLevel - 1) * 1.5}rem` }}
            >
              •
            </span>
            {processCodeAndPaths(processedLine, lineIndex)}
          </span>
        );
      }

      // Process inline code segments (single backticks) within each line
      if (line.includes("`") || line.includes("[")) {
        return (
          <span key={`line-${lineIndex}`} className="block">
            {processCodeAndPaths(line, lineIndex)}
          </span>
        );
      }
      // Lines without code or file paths
      else if (line.trim()) {
        return (
          <span key={`line-${lineIndex}`} className="block">
            {formatTechnicalText(line)}
          </span>
        );
      }
      // Empty lines become line breaks (except for the last line)
      if (lineIndex < text.split("\n").length - 1) {
        return <br key={`line-${lineIndex}`} />;
      }
      return null; // Skip the last line break if it's empty
    })
    .filter(Boolean); // Filter out null values (empty last lines)

  return <div>{segments}</div>;
}

/**
 * Helper function to process code and file paths in a line
 */
function processCodeAndPaths(line: string, lineIndex: number): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const backtickParts = line.split(/(`[^`]+`)/g);

  // Process each part from the backtick split
  backtickParts.forEach((part, partIndex) => {
    const key = `line-${lineIndex}-part-${partIndex}`;

    // Handle inline code elements
    if (part.startsWith("`") && part.endsWith("`")) {
      // Extract code content without the backticks
      const code = part.slice(1, -1);
      parts.push(
        <code
          key={key}
          className="break-all rounded bg-gray-100 px-1 py-0.5 font-mono text-xs text-gray-800"
        >
          {formatTechnicalText(code)}
        </code>,
      );
    }
    // Handle any non-code parts (may contain file paths in brackets)
    else if (part.trim()) {
      // Check if this part contains file paths
      if (part.includes("[") && part.includes("]")) {
        const pathParts = part.split(/(\[[^\]]+\])/g);

        // Process file paths and surrounding text
        pathParts.forEach((pathPart, pathIndex) => {
          const pathKey = `${key}-path-${pathIndex}`;

          if (pathPart.startsWith("[") && pathPart.endsWith("]")) {
            // Format file paths with special styling
            parts.push(
              <code
                key={pathKey}
                className="mx-0.5 break-all rounded-sm bg-gray-50 px-0.5 py-0 font-mono text-xs text-gray-600"
              >
                {formatTechnicalText(pathPart)}
              </code>,
            );
          } else if (pathPart.trim()) {
            // Add non-path text
            parts.push(
              <span key={pathKey}>{formatTechnicalText(pathPart)}</span>,
            );
          }
        });
      } else {
        // Just regular text
        parts.push(<span key={key}>{formatTechnicalText(part)}</span>);
      }
    }
  });

  return parts;
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
