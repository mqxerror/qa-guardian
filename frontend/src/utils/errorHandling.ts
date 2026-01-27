/**
 * Error handling utilities for graceful network error handling
 */

/**
 * Checks if an error is a network-related error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // Fetch throws TypeError for network errors
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('failed to fetch') ||
      message.includes('networkerror') ||
      message.includes('load failed') ||
      message.includes('net::') ||
      message.includes('cors')
    );
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('offline') ||
      message.includes('connection') ||
      message.includes('timeout')
    );
  }

  return false;
}

/**
 * Checks if the browser is currently offline
 */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

/**
 * Returns a user-friendly error message based on the error type
 */
export function getErrorMessage(error: unknown, fallbackMessage = 'An unexpected error occurred'): string {
  // Check if we're offline first
  if (isOffline()) {
    return 'You appear to be offline. Please check your internet connection and try again.';
  }

  // Check for network errors
  if (isNetworkError(error)) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }

  // Check for timeout errors
  if (error instanceof Error && error.message.toLowerCase().includes('timeout')) {
    return 'The request took too long. Please try again.';
  }

  // Check for HTTP error responses
  if (error instanceof Error) {
    const message = error.message;

    // Server errors (5xx)
    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
      return 'The server is temporarily unavailable. Please try again later.';
    }

    // Rate limiting
    if (message.includes('429') || message.toLowerCase().includes('too many')) {
      return 'Too many requests. Please wait a moment and try again.';
    }

    // Return the error message if it's meaningful
    if (message && message.length < 200 && !message.includes('undefined')) {
      return message;
    }
  }

  return fallbackMessage;
}

/**
 * Wraps a fetch call with enhanced error handling
 */
export async function fetchWithErrorHandling<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  if (isOffline()) {
    throw new Error('You appear to be offline. Please check your internet connection.');
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;

      try {
        const data = await response.json();
        if (data.message) {
          errorMessage = data.message;
        }
      } catch {
        // JSON parsing failed, use default message
      }

      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    if (isNetworkError(error)) {
      throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
    }
    throw error;
  }
}

/**
 * Creates a retry function for failed operations
 */
export function createRetryHandler(
  operation: () => Promise<void>,
  onRetry?: () => void
): () => Promise<void> {
  return async () => {
    if (onRetry) {
      onRetry();
    }
    await operation();
  };
}

/**
 * Helper to show appropriate error messages based on the error type
 * Returns both the message and whether it's a recoverable (retriable) error
 */
export function analyzeError(error: unknown): { message: string; isRetriable: boolean } {
  const isNetwork = isNetworkError(error);
  const isOfflineError = isOffline();

  return {
    message: getErrorMessage(error),
    isRetriable: isNetwork || isOfflineError,
  };
}
