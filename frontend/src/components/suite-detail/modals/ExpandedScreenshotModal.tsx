/**
 * ExpandedScreenshotModal Component
 * Feature #50: Extract modals from TestSuitePage.tsx
 * Feature #35: Expanded screenshot modal for live screenshot streaming
 * Feature #127: Mobile responsive design audit and fixes
 * Feature #634: Migrated to Modal/ModalBody
 */

import React from 'react';
import { Modal, ModalBody } from '../../ui/Modal';

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
 <Modal isOpen onClose={onClose} title="Screenshot Preview" size="full">
 <ModalBody className="overflow-auto max-h-[calc(90vh-60px)]">
 <img
 src={`data:image/jpeg;base64,${screenshotBase64}`}
 alt="Expanded screenshot"
 className="max-w-full max-h-full object-contain rounded"
 />
 </ModalBody>
 </Modal>
 );
}

export default ExpandedScreenshotModal;
