/**
 * Feature #127: Mobile-responsive Modal component
 * Feature #616: Added open/close animations with CSS transitions
 *
 * Provides consistent modal styling with proper mobile support:
 * - max-h-[90vh] for small screens
 * - overflow-y-auto for scrollable content
 * - Proper padding and responsive widths
 * - Keyboard trap and accessibility
 * - Smooth enter/exit animations (respects prefers-reduced-motion)
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { X } from 'lucide-react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** Modal title for accessibility */
  title?: string;
  /** Modal content */
  children: React.ReactNode;
  /** Size of the modal */
  size?: ModalSize;
  /** Additional CSS classes for the modal container */
  className?: string;
  /** Whether clicking the backdrop closes the modal */
  closeOnBackdrop?: boolean;
  /** Whether pressing Escape closes the modal */
  closeOnEscape?: boolean;
  /** ID for aria-labelledby (auto-generated if not provided) */
  titleId?: string;
  /** Whether to show a close button */
  showCloseButton?: boolean;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-4xl',
};

/**
 * Mobile-responsive modal component
 *
 * Usage:
 * ```tsx
 * <Modal isOpen={open} onClose={() => setOpen(false)} title="Edit Item" size="md">
 *   <ModalHeader>Edit Item</ModalHeader>
 *   <ModalBody>Content here</ModalBody>
 *   <ModalFooter>
 *     <Button onClick={onClose}>Cancel</Button>
 *     <Button variant="primary" onClick={onSave}>Save</Button>
 *   </ModalFooter>
 * </Modal>
 * ```
 */
export function Modal({
  isOpen,
  onClose,
  children,
  size = 'md',
  className = '',
  closeOnBackdrop = true,
  closeOnEscape = true,
  titleId,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const generatedTitleId = useRef(`modal-title-${Math.random().toString(36).substr(2, 9)}`);
  const actualTitleId = titleId || generatedTitleId.current;

  // Feature #616: Track animation state for smooth exit
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Feature #616: Handle close with animation
  const handleClose = useCallback(() => {
    if (isClosing) return; // Prevent double-close
    setIsClosing(true);
    // Wait for exit animation to complete before actually closing
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animationDuration = prefersReducedMotion ? 0 : 150;
    setTimeout(() => {
      setIsClosing(false);
      setIsVisible(false);
      onClose();
    }, animationDuration);
  }, [onClose, isClosing]);

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        handleClose();
      }
    },
    [closeOnEscape, handleClose]
  );

  // Feature #616: Sync visibility with isOpen prop
  useEffect(() => {
    if (isOpen && !isVisible && !isClosing) {
      setIsVisible(true);
    }
  }, [isOpen, isVisible, isClosing]);

  // Focus the modal only when it first becomes visible (not on every re-render)
  // Separating this from the keydown effect prevents focus-stealing from inputs
  // when parent re-renders cause handleKeyDown to get a new reference.
  const hasFocused = useRef(false);
  useEffect(() => {
    if (isVisible && !hasFocused.current && modalRef.current) {
      modalRef.current.focus();
      hasFocused.current = true;
    }
    if (!isVisible) {
      hasFocused.current = false;
    }
  }, [isVisible]);

  // Escape handler and body scroll lock
  useEffect(() => {
    if (!isVisible) return;

    document.addEventListener('keydown', handleKeyDown);

    // Prevent body scroll when modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isVisible, handleKeyDown]);

  // Don't render if not visible
  if (!isVisible) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Feature #616: Animation classes based on state
  const backdropAnimationClass = isClosing
    ? 'animate-modal-backdrop-exit'
    : 'animate-modal-backdrop-enter';
  const contentAnimationClass = isClosing
    ? 'animate-modal-content-exit'
    : 'animate-modal-content-enter';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 ${backdropAnimationClass}`}
      onMouseDown={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={actualTitleId}
        tabIndex={-1}
        className={`
          w-full ${sizeClasses[size]}
          max-h-[90vh] overflow-y-auto
          rounded-lg border border-border bg-card shadow-lg
          focus:outline-none
          ${contentAnimationClass}
          ${className}
        `.trim().replace(/\s+/g, ' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Modal header component with optional close button
 */
interface ModalHeaderProps {
  children: React.ReactNode;
  onClose?: () => void;
  showCloseButton?: boolean;
  id?: string;
  className?: string;
}

export function ModalHeader({
  children,
  onClose,
  showCloseButton = true,
  id,
  className = '',
}: ModalHeaderProps) {
  return (
    <div className={`flex items-center justify-between p-4 sm:p-6 border-b border-border ${className}`}>
      <h2 id={id} className="text-lg font-semibold text-foreground">
        {children}
      </h2>
      {showCloseButton && onClose && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
          className="relative z-10 p-2 -m-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

/**
 * Modal body component for main content
 */
interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalBody({ children, className = '' }: ModalBodyProps) {
  return (
    <div className={`p-4 sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Modal footer component for action buttons
 */
interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <div className={`flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 p-4 sm:p-6 pt-0 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Legacy modal container class for inline modals
 * Use this to wrap existing modal content for mobile responsiveness
 */
export const modalContainerClasses = 'w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card p-4 sm:p-6 shadow-lg';

export default Modal;
