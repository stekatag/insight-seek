/**
 * Type guard for checking if a value is a specific type of error
 */
export interface ErrorWithMessage {
  message: string;
}

export interface ErrorWithName {
  name: string;
}

/**
 * Check if value is an object with a message property
 */
export function hasMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as ErrorWithMessage).message === "string"
  );
}

/**
 * Check if value is an object with a name property
 */
export function hasName(error: unknown): error is ErrorWithName {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof (error as ErrorWithName).name === "string"
  );
}

/**
 * Check if an error contains a specific message substring
 */
export function hasMessageContaining(
  error: unknown,
  substring: string,
): boolean {
  return hasMessage(error) && error.message.includes(substring);
}

/**
 * Check if an error has a specific name
 */
export function hasErrorName(error: unknown, errorName: string): boolean {
  return hasName(error) && error.name === errorName;
}

/**
 * Check if an error is an AbortError or a timeout error
 */
export function isAbortOrTimeoutError(
  error: unknown,
  signal?: AbortSignal | null,
): boolean {
  // Check if operation was deliberately aborted
  if (signal?.aborted) return true;

  if (error instanceof Error) {
    // Check for common abort/timeout error patterns
    if (
      error.name === "AbortError" ||
      error.message.includes("aborted") ||
      error.message.includes("timed out") ||
      error.message.includes("timeout") ||
      error.message.includes("Stream closed")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Extract a readable error message from an unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (hasMessage(error)) {
    return error.message;
  }
  return "Unknown error occurred";
}
