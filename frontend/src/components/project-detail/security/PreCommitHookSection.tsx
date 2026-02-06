/**
 * PreCommitHookSection - Pre-commit hook generation UI
 * Feature #102: Extracted from SecurityTab.tsx
 */
import { SecretPattern } from '../types';

export interface PreCommitHookSectionProps {
  projectId: string;
  secretPatterns: SecretPattern[];
}

export function PreCommitHookSection({ projectId, secretPatterns }: PreCommitHookSectionProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Pre-commit Hook</h3>
            <p className="text-sm text-muted-foreground">
              Generate a pre-commit hook to prevent secrets from being committed
            </p>
          </div>
        </div>
      </div>

      <div className="bg-muted/30 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-medium text-foreground mb-2">Why use a pre-commit hook?</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Catches secrets before they enter your git history</li>
          <li>Prevents accidental credential exposure</li>
          <li>Enforces security at the developer level</li>
          <li>Works offline, no server required</li>
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Pre-commit Framework Option */}
        <div className="border border-border rounded-lg p-4 hover:border-green-500 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="font-medium text-foreground">.pre-commit-config.yaml</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            For the pre-commit framework. Easiest setup with automatic updates.
          </p>
          <div className="flex gap-2">
            <a
              href={`/api/v1/projects/${projectId}/sast/gitleaks/pre-commit/download?format=pre-commit&mode=fail`}
              download=".pre-commit-config.yaml"
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Block Mode
            </a>
            <a
              href={`/api/v1/projects/${projectId}/sast/gitleaks/pre-commit/download?format=pre-commit&mode=warn`}
              download=".pre-commit-config.yaml"
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Warn Mode
            </a>
          </div>
        </div>

        {/* Git Hook Option */}
        <div className="border border-border rounded-lg p-4 hover:border-green-500 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="font-medium text-foreground">Git Hook Script</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Native bash script for .git/hooks/pre-commit. No dependencies required.
          </p>
          <div className="flex gap-2">
            <a
              href={`/api/v1/projects/${projectId}/sast/gitleaks/pre-commit/download?format=git-hook&mode=fail`}
              download="pre-commit"
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Block Mode
            </a>
            <a
              href={`/api/v1/projects/${projectId}/sast/gitleaks/pre-commit/download?format=git-hook&mode=warn`}
              download="pre-commit"
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Warn Mode
            </a>
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>Block Mode:</strong> Prevents commits when secrets are detected.{' '}
          <strong>Warn Mode:</strong> Shows warnings but allows the commit.
          {secretPatterns.filter(p => p.enabled).length > 0 && (
            <> Your {secretPatterns.filter(p => p.enabled).length} custom pattern(s) will be included.</>
          )}
        </p>
      </div>
    </div>
  );
}
