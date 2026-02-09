/**
 * ScreenshotModal Component
 * Feature #514: Extracted from QuickTestPage.tsx
 *
 * Full-screen modal for viewing desktop/mobile screenshots
 * captured during Wave 2 (Visual + Performance).
 */

import {
  X,
  Monitor,
  Smartphone,
} from 'lucide-react';

// ============================================================
// Props
// ============================================================

export interface ScreenshotModalProps {
  isOpen: boolean;
  url: string | null;
  type: 'desktop' | 'mobile' | null;
  onClose: () => void;
}

// ============================================================
// Component
// ============================================================

export function ScreenshotModal({ isOpen, url, type, onClose }: ScreenshotModalProps) {
  if (!isOpen || !url) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        {/* Type label */}
        <div className="absolute -top-10 left-0 flex items-center gap-2 text-white text-sm">
          {type === 'desktop' ? (
            <>
              <Monitor className="w-4 h-4" />
              <span>Desktop Screenshot</span>
            </>
          ) : (
            <>
              <Smartphone className="w-4 h-4" />
              <span>Mobile Screenshot</span>
            </>
          )}
        </div>
        {/* Image */}
        <img
          src={url}
          alt={`${type} Screenshot`}
          className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

export default ScreenshotModal;
