/**
 * ExpandedScreenshotModal Component
 * Feature #50: Extract modals from TestSuitePage.tsx
 * Feature #35: Expanded screenshot modal for live screenshot streaming
 */

import React from 'react';

interface ExpandedScreenshotModalProps {
  screenshotBase64: string | null;
  onClose: () => void;
}

export function ExpandedScreenshotModal({
  screenshotBase64,
  onClose,
}: ExpandedScreenshotModalProps) {
  if (!screenshotBase64) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Screenshot Preview
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-2 overflow-auto max-h-[calc(90vh-60px)]">
          <img
            src={`data:image/jpeg;base64,${screenshotBase64}`}
            alt="Expanded screenshot"
            className="max-w-full max-h-full object-contain rounded"
          />
        </div>
      </div>
    </div>
  );
}

export default ExpandedScreenshotModal;
