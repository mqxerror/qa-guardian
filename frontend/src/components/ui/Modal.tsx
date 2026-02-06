/**
 * Feature #127: Mobile-responsive Modal component
 * Provides consistent modal styling with proper mobile support:
 * - max-h-[90vh] for small screens
 * - overflow-y-auto for scrollable content
 * - Proper padding and responsive widths
 * - Keyboard trap and accessibility
 */

import React, { useEffect, useRef, useCallback } from 'react';

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
  title,
  children,
  size = 'md',
  className = '',
  closeOnBackdrop = true,
  closeOnEscape = true,
  titleId,
  showCloseButton = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const generatedTitleId = useRef(`modal-title-${Math.random().toString(36).substr(2, 9)}`);
  const actualTitleId = titleId || generatedTitleId.current;

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  // Focus trap and escape handler
  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', handleKeyDown);

    // Prevent body scroll when modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the modal
    if (modalRef.current) {
      modalRef.current.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
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
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close modal"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
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
