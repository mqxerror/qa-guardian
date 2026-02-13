// Feature #760: ShareTestModal - Share a test via shareable link
// Creates a share link using the backend share API endpoint

import { useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../../ui/Modal';
import { Share2, Copy, Check, Link, Clock } from 'lucide-react';

interface ShareTestModalProps {
  testName: string;
  testId: string;
  latestRunId: string | null;
  token: string;
  onClose: () => void;
}

export function ShareTestModal({
  testName,
  testId,
  latestRunId,
  token,
  onClose,
}: ShareTestModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareError, setShareError] = useState('');
  const [copied, setCopied] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [includeArtifacts, setIncludeArtifacts] = useState(true);
  const [expiresAt, setExpiresAt] = useState('');

  const handleCreateShareLink = async () => {
    if (!latestRunId) {
      setShareError('No test run available to share. Please run the test first.');
      return;
    }

    setIsCreating(true);
    setShareError('');

    try {
      const response = await fetch(`/api/v1/runs/${latestRunId}/results/${testId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          expires_in_hours: expiresInHours,
          include_artifacts: includeArtifacts,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create share link (${response.status})`);
      }

      const data = await response.json();
      // Build a frontend-friendly share URL
      const frontendShareUrl = `${window.location.origin}/shared/${data.share_token}`;
      setShareUrl(frontendShareUrl);
      setExpiresAt(data.expires_at);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Failed to create share link');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for clipboard API not available
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatExpiry = (isoDate: string) => {
    try {
      return new Date(isoDate).toLocaleString();
    } catch {
      return isoDate;
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Share Test" size="md">
      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          Share Test
        </div>
      </ModalHeader>
      <ModalBody>
        <p className="text-muted-foreground mb-4">
          Create a shareable link for <strong>"{testName}"</strong> that anyone can view without logging in.
        </p>

        {!latestRunId && (
          <div className="rounded-md bg-warning/10 border border-warning/20 p-3 text-sm text-warning mb-4">
            No test runs found. Run the test first to create a shareable link.
          </div>
        )}

        {!shareUrl && latestRunId && (
          <div className="space-y-4">
            {/* Expiration setting */}
            <div>
              <label htmlFor="share-expiry" className="block text-sm font-medium text-foreground mb-1">
                <Clock className="inline h-4 w-4 mr-1" />
                Link expires in
              </label>
              <select
                id="share-expiry"
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value={1}>1 hour</option>
                <option value={6}>6 hours</option>
                <option value={24}>24 hours</option>
                <option value={72}>3 days</option>
                <option value={168}>7 days</option>
                <option value={720}>30 days</option>
              </select>
            </div>

            {/* Include artifacts toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="share-artifacts"
                checked={includeArtifacts}
                onChange={(e) => setIncludeArtifacts(e.target.checked)}
                className="rounded border-input"
              />
              <label htmlFor="share-artifacts" className="text-sm text-foreground">
                Include screenshots and artifacts
              </label>
            </div>
          </div>
        )}

        {/* Generated share URL */}
        {shareUrl && (
          <div className="space-y-3">
            <div className="rounded-md bg-success/10 border border-success/20 p-3 text-sm text-success">
              Share link created successfully!
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-foreground break-all">
                <Link className="inline h-4 w-4 mr-1 text-muted-foreground" />
                {shareUrl}
              </div>
              <button
                onClick={handleCopyUrl}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </div>

            {expiresAt && (
              <p className="text-xs text-muted-foreground">
                <Clock className="inline h-3 w-3 mr-1" />
                Expires: {formatExpiry(expiresAt)}
              </p>
            )}
          </div>
        )}

        {/* Error display */}
        {shareError && (
          <div
            role="alert"
            className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            {shareError}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <button
          onClick={onClose}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          {shareUrl ? 'Done' : 'Cancel'}
        </button>
        {!shareUrl && latestRunId && (
          <button
            onClick={handleCreateShareLink}
            disabled={isCreating}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isCreating ? (
              <>Creating...</>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                Create Share Link
              </>
            )}
          </button>
        )}
      </ModalFooter>
    </Modal>
  );
}
