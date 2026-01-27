/**
 * URLInput Component
 * Feature #1802: URL input with validation, favicon, green/red states
 *
 * Features:
 * - URL validation with visual feedback (green/red borders)
 * - Favicon display for valid URLs
 * - Uses project base_url for placeholder (NO example.com)
 * - Auto-prefixes https:// for domain-only inputs
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * URL validation regex patterns
 */
const URL_REGEX = /^https?:\/\/[^\s<>"']+$/i;
const DOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z]{2,})+(?:\/[^\s]*)?$/i;

/**
 * Validation state
 */
type ValidationState = 'idle' | 'valid' | 'invalid';

/**
 * URLInput props
 */
export interface URLInputProps {
  /** Current URL value */
  value: string;
  /** Change handler */
  onChange: (url: string) => void;
  /** Custom placeholder text */
  placeholder?: string;
  /** Project base URL for smart placeholder */
  projectBaseUrl?: string;
  /** Show favicon for valid URLs */
  showFavicon?: boolean;
  /** Input ID for label association */
  id?: string;
  /** CSS class name */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Error message from external validation */
  error?: string;
  /** Label text */
  label?: string;
  /** Required field indicator */
  required?: boolean;
  /** Aria describedby for accessibility */
  ariaDescribedBy?: string;
}

/**
 * Normalize URL with https:// prefix
 */
function normalizeUrl(input: string): { url: string | null; isValid: boolean } {
  const trimmed = input.trim();

  if (!trimmed) {
    return { url: null, isValid: false };
  }

  // Check if it's already a valid URL
  if (URL_REGEX.test(trimmed)) {
    return { url: trimmed, isValid: true };
  }

  // Try adding https:// prefix
  if (DOMAIN_REGEX.test(trimmed)) {
    const urlWithPrefix = `https://${trimmed}`;
    return { url: urlWithPrefix, isValid: true };
  }

  // Check if it looks like a URL with typo
  if (trimmed.includes('.') && !trimmed.includes(' ')) {
    let fixed = trimmed;
    if (!fixed.startsWith('http')) {
      fixed = `https://${fixed}`;
    }
    if (URL_REGEX.test(fixed)) {
      return { url: fixed, isValid: true };
    }
  }

  return { url: null, isValid: false };
}

/**
 * Get favicon URL for a domain
 */
function getFaviconUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Use Google's favicon service for reliable favicons
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
  } catch {
    return '';
  }
}

/**
 * URLInput component
 */
export const URLInput: React.FC<URLInputProps> = ({
  value,
  onChange,
  placeholder,
  projectBaseUrl,
  showFavicon = true,
  id = 'url-input',
  className = '',
  disabled = false,
  autoFocus = false,
  error,
  label,
  required = false,
  ariaDescribedBy,
}) => {
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [faviconUrl, setFaviconUrl] = useState<string>('');
  const [faviconError, setFaviconError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate smart placeholder - NO example.com
  const smartPlaceholder = projectBaseUrl
    ? projectBaseUrl
    : placeholder || 'https://your-site.com';

  // Validate URL and update favicon
  const validateAndUpdateFavicon = useCallback(
    (url: string) => {
      const { url: normalizedUrl, isValid } = normalizeUrl(url);

      if (!url.trim()) {
        setValidationState('idle');
        setFaviconUrl('');
        return;
      }

      if (isValid && normalizedUrl) {
        setValidationState('valid');
        if (showFavicon) {
          setFaviconUrl(getFaviconUrl(normalizedUrl));
          setFaviconError(false);
        }
      } else {
        setValidationState('invalid');
        setFaviconUrl('');
      }
    },
    [showFavicon]
  );

  // Debounced validation
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      validateAndUpdateFavicon(value);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, validateAndUpdateFavicon]);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [autoFocus]);

  // Handle input change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  // Handle paste - normalize URL
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pastedText = e.clipboardData.getData('text');
      const { url: normalizedUrl, isValid } = normalizeUrl(pastedText);

      if (isValid && normalizedUrl && normalizedUrl !== pastedText) {
        e.preventDefault();
        onChange(normalizedUrl);
      }
    },
    [onChange]
  );

  // Handle blur - normalize URL
  const handleBlur = useCallback(() => {
    if (value.trim()) {
      const { url: normalizedUrl, isValid } = normalizeUrl(value);
      if (isValid && normalizedUrl && normalizedUrl !== value) {
        onChange(normalizedUrl);
      }
    }
  }, [value, onChange]);

  // Determine border color
  const getBorderClass = () => {
    if (error) return 'border-red-500 dark:border-red-600';
    if (validationState === 'valid') return 'border-green-500 dark:border-green-600';
    if (validationState === 'invalid') return 'border-red-300 dark:border-red-600';
    return 'border-gray-300 dark:border-gray-600';
  };

  // Determine focus ring color
  const getFocusClass = () => {
    if (error || validationState === 'invalid') {
      return 'focus:ring-red-500 focus:border-red-500';
    }
    if (validationState === 'valid') {
      return 'focus:ring-green-500 focus:border-green-500';
    }
    return 'focus:ring-blue-500 focus:border-blue-500';
  };

  return (
    <div className={`url-input-wrapper ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {/* Favicon */}
        {showFavicon && faviconUrl && !faviconError && validationState === 'valid' && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
            <img
              src={faviconUrl}
              alt=""
              className="w-4 h-4 object-contain"
              onError={() => setFaviconError(true)}
            />
          </div>
        )}

        {/* Input */}
        <input
          ref={inputRef}
          id={id}
          type="url"
          value={value}
          onChange={handleChange}
          onPaste={handlePaste}
          onBlur={handleBlur}
          placeholder={smartPlaceholder}
          disabled={disabled}
          required={required}
          aria-invalid={validationState === 'invalid' || !!error}
          aria-describedby={
            error
              ? `${id}-error`
              : ariaDescribedBy || (validationState === 'invalid' ? `${id}-hint` : undefined)
          }
          className={`
            w-full px-4 py-2.5 rounded-lg border
            bg-white dark:bg-gray-700
            text-gray-900 dark:text-white
            placeholder-gray-400 dark:placeholder-gray-500
            transition-colors duration-200
            ${getBorderClass()}
            ${getFocusClass()}
            focus:ring-2 focus:outline-none
            disabled:opacity-50 disabled:cursor-not-allowed
            ${showFavicon && faviconUrl && !faviconError && validationState === 'valid' ? 'pl-10' : ''}
            ${validationState === 'valid' ? 'pr-10' : ''}
          `}
        />

        {/* Validation icon */}
        {validationState === 'valid' && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg
              className="w-5 h-5 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}

        {validationState === 'invalid' && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg
              className="w-5 h-5 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Validation hint for invalid state (when no explicit error) */}
      {!error && validationState === 'invalid' && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-red-600 dark:text-red-400">
          Please enter a valid URL
        </p>
      )}
    </div>
  );
};

export default URLInput;
