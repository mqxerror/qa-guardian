/**
 * useFocusTrap Hook
 * Feature #119: Implement focus trap in all modal dialogs
 *
 * This hook traps focus within a container element (typically a modal dialog).
 * It handles:
 * - Tab navigation within the container
 * - Shift+Tab reverse navigation
 * - Escape key to close the modal
 * - Auto-focus on the first focusable element when the modal opens
 * - Restoring focus to the previously focused element when the modal closes
 */

import { useEffect, useRef, useCallback } from 'react';

// Selector for all focusable elements
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface UseFocusTrapOptions {
  /** Whether the focus trap is active */
  isOpen: boolean;
  /** Callback when Escape is pressed */
  onClose?: () => void;
  /** Whether to auto-focus the first element when opened */
  autoFocus?: boolean;
  /** Whether to restore focus when closed */
  restoreFocus?: boolean;
}

export function useFocusTrap<T extends HTMLElement = HTMLElement>({
  isOpen,
  onClose,
  autoFocus = true,
  restoreFocus = true,
}: UseFocusTrapOptions) {
  const containerRef = useRef<T>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => el.offsetParent !== null); // Filter out hidden elements
  }, []);

  // Handle Tab key navigation
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen || !containerRef.current) return;

      // Handle Escape key
      if (event.key === 'Escape' && onClose) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      // Handle Tab key for focus trapping
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      // Shift+Tab: if on first element, move to last
      if (event.shiftKey) {
        if (activeElement === firstElement || !containerRef.current.contains(activeElement)) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, move to first
        if (activeElement === lastElement || !containerRef.current.contains(activeElement)) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    },
    [isOpen, onClose, getFocusableElements]
  );

  // Set up focus trap when modal opens
  useEffect(() => {
    if (isOpen) {
      // Store the currently focused element to restore later
      if (restoreFocus) {
        previouslyFocusedRef.current = document.activeElement;
      }

      // Add event listener for keyboard navigation
      document.addEventListener('keydown', handleKeyDown);

      // Auto-focus the first focusable element
      if (autoFocus) {
        // Use setTimeout to ensure the modal is rendered
        const timeoutId = setTimeout(() => {
          const focusableElements = getFocusableElements();
          if (focusableElements.length > 0) {
            focusableElements[0].focus();
          } else if (containerRef.current) {
            // If no focusable elements, focus the container itself
            containerRef.current.focus();
          }
        }, 0);

        return () => {
          clearTimeout(timeoutId);
          document.removeEventListener('keydown', handleKeyDown);
        };
      }

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      // Restore focus when modal closes
      if (restoreFocus && previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus();
        previouslyFocusedRef.current = null;
      }
    }
  }, [isOpen, handleKeyDown, autoFocus, restoreFocus, getFocusableElements]);

  return containerRef;
}

export default useFocusTrap;
