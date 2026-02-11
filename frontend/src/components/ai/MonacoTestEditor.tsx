// ============================================================================
// FEATURE #325: Monaco Editor for AI Test Code Editing
// Provides syntax-highlighted, intellisense-capable code editing for generated tests
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import Editor, { OnMount, OnChange, loader } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { AlignLeft, Save, Download, Copy, Loader2 } from 'lucide-react';

// Configure Monaco to use CDN instead of local files for better compatibility
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs',
  },
});

interface MonacoTestEditorProps {
  code: string;
  language: 'typescript' | 'javascript';
  onChange?: (value: string) => void;
  readOnly?: boolean;
  theme?: 'vs-dark' | 'vs-light' | 'auto';
  height?: string;
  showMinimap?: boolean;
  showLineNumbers?: boolean;
  wordWrap?: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
  fontSize?: number;
  onSave?: (code: string) => void;
  onCopy?: () => void;
  onDownload?: () => void;
  className?: string;
}

// Playwright type definitions for intellisense
const playwrightTypes = `
declare const test: {
  (title: string, fn: (params: { page: Page, context: BrowserContext, browser: Browser }) => Promise<void>): void;
  describe(title: string, fn: () => void): void;
  beforeEach(fn: (params: { page: Page }) => Promise<void>): void;
  afterEach(fn: (params: { page: Page }) => Promise<void>): void;
  beforeAll(fn: () => Promise<void>): void;
  afterAll(fn: () => Promise<void>): void;
  skip(title: string, fn: (params: { page: Page }) => Promise<void>): void;
  only(title: string, fn: (params: { page: Page }) => Promise<void>): void;
};

declare const expect: {
  (actual: unknown): {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toContain(expected: unknown): void;
    toHaveLength(expected: number): void;
    toHaveText(expected: string | RegExp): Promise<void>;
    toHaveValue(expected: string): Promise<void>;
    toHaveAttribute(name: string, value?: string): Promise<void>;
    toBeVisible(): Promise<void>;
    toBeHidden(): Promise<void>;
    toBeEnabled(): Promise<void>;
    toBeDisabled(): Promise<void>;
    toBeChecked(): Promise<void>;
    toHaveURL(url: string | RegExp): Promise<void>;
    toHaveTitle(title: string | RegExp): Promise<void>;
    toHaveCount(count: number): Promise<void>;
    toHaveScreenshot(name?: string): Promise<void>;
    not: ReturnType<typeof expect>;
  };
};

interface Page {
  goto(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<Response | null>;
  click(selector: string, options?: { button?: 'left' | 'right' | 'middle', clickCount?: number }): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  type(selector: string, text: string, options?: { delay?: number }): Promise<void>;
  press(selector: string, key: string): Promise<void>;
  check(selector: string): Promise<void>;
  uncheck(selector: string): Promise<void>;
  selectOption(selector: string, values: string | string[]): Promise<string[]>;
  hover(selector: string): Promise<void>;
  focus(selector: string): Promise<void>;
  waitForSelector(selector: string, options?: { state?: 'attached' | 'detached' | 'visible' | 'hidden', timeout?: number }): Promise<ElementHandle | null>;
  waitForLoadState(state?: 'load' | 'domcontentloaded' | 'networkidle'): Promise<void>;
  waitForURL(url: string | RegExp, options?: { timeout?: number }): Promise<void>;
  waitForTimeout(timeout: number): Promise<void>;
  screenshot(options?: { path?: string, fullPage?: boolean }): Promise<Buffer>;
  locator(selector: string): Locator;
  getByRole(role: string, options?: { name?: string | RegExp, exact?: boolean }): Locator;
  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator;
  getByLabel(text: string | RegExp, options?: { exact?: boolean }): Locator;
  getByPlaceholder(text: string | RegExp, options?: { exact?: boolean }): Locator;
  getByTestId(testId: string | RegExp): Locator;
  getByAltText(text: string | RegExp, options?: { exact?: boolean }): Locator;
  getByTitle(text: string | RegExp, options?: { exact?: boolean }): Locator;
  evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
  evaluateHandle<T>(fn: () => T | Promise<T>): Promise<JSHandle<T>>;
  content(): Promise<string>;
  title(): Promise<string>;
  url(): string;
  reload(): Promise<Response | null>;
  goBack(): Promise<Response | null>;
  goForward(): Promise<Response | null>;
  close(): Promise<void>;
  setViewportSize(size: { width: number, height: number }): Promise<void>;
  keyboard: Keyboard;
  mouse: Mouse;
}

interface Locator {
  click(options?: { button?: 'left' | 'right' | 'middle', force?: boolean }): Promise<void>;
  fill(value: string): Promise<void>;
  type(text: string, options?: { delay?: number }): Promise<void>;
  press(key: string): Promise<void>;
  check(): Promise<void>;
  uncheck(): Promise<void>;
  selectOption(values: string | string[]): Promise<string[]>;
  hover(): Promise<void>;
  focus(): Promise<void>;
  blur(): Promise<void>;
  clear(): Promise<void>;
  textContent(): Promise<string | null>;
  innerText(): Promise<string>;
  innerHTML(): Promise<string>;
  inputValue(): Promise<string>;
  getAttribute(name: string): Promise<string | null>;
  isVisible(): Promise<boolean>;
  isHidden(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
  isDisabled(): Promise<boolean>;
  isChecked(): Promise<boolean>;
  count(): Promise<number>;
  first(): Locator;
  last(): Locator;
  nth(index: number): Locator;
  filter(options: { hasText?: string | RegExp, has?: Locator }): Locator;
  screenshot(options?: { path?: string }): Promise<Buffer>;
  scrollIntoViewIfNeeded(): Promise<void>;
  waitFor(options?: { state?: 'attached' | 'detached' | 'visible' | 'hidden', timeout?: number }): Promise<void>;
}

interface BrowserContext {
  newPage(): Promise<Page>;
  pages(): Page[];
  cookies(urls?: string | string[]): Promise<Cookie[]>;
  addCookies(cookies: Cookie[]): Promise<void>;
  clearCookies(): Promise<void>;
  grantPermissions(permissions: string[], options?: { origin?: string }): Promise<void>;
  setGeolocation(geolocation: { latitude: number, longitude: number, accuracy?: number } | null): Promise<void>;
  close(): Promise<void>;
}

interface Browser {
  newContext(options?: BrowserContextOptions): Promise<BrowserContext>;
  newPage(): Promise<Page>;
  close(): Promise<void>;
  version(): string;
}

interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

interface BrowserContextOptions {
  viewport?: { width: number, height: number } | null;
  userAgent?: string;
  locale?: string;
  timezoneId?: string;
  geolocation?: { latitude: number, longitude: number, accuracy?: number };
  permissions?: string[];
  extraHTTPHeaders?: Record<string, string>;
  httpCredentials?: { username: string, password: string };
  ignoreHTTPSErrors?: boolean;
  isMobile?: boolean;
  hasTouch?: boolean;
  javaScriptEnabled?: boolean;
  acceptDownloads?: boolean;
}

interface Keyboard {
  type(text: string, options?: { delay?: number }): Promise<void>;
  press(key: string, options?: { delay?: number }): Promise<void>;
  down(key: string): Promise<void>;
  up(key: string): Promise<void>;
  insertText(text: string): Promise<void>;
}

interface Mouse {
  click(x: number, y: number, options?: { button?: 'left' | 'right' | 'middle', clickCount?: number }): Promise<void>;
  dblclick(x: number, y: number, options?: { button?: 'left' | 'right' | 'middle' }): Promise<void>;
  move(x: number, y: number, options?: { steps?: number }): Promise<void>;
  down(options?: { button?: 'left' | 'right' | 'middle' }): Promise<void>;
  up(options?: { button?: 'left' | 'right' | 'middle' }): Promise<void>;
  wheel(deltaX: number, deltaY: number): Promise<void>;
}

interface ElementHandle<T = Element> {
  click(): Promise<void>;
  fill(value: string): Promise<void>;
  textContent(): Promise<string | null>;
  innerText(): Promise<string>;
  innerHTML(): Promise<string>;
  getAttribute(name: string): Promise<string | null>;
  boundingBox(): Promise<{ x: number, y: number, width: number, height: number } | null>;
  screenshot(options?: { path?: string }): Promise<Buffer>;
}

interface JSHandle<T> {
  evaluate<R>(fn: (obj: T) => R): Promise<R>;
  getProperty(propertyName: string): Promise<JSHandle>;
  dispose(): Promise<void>;
}

interface Response {
  ok(): boolean;
  status(): number;
  statusText(): string;
  url(): string;
  headers(): Record<string, string>;
  body(): Promise<Buffer>;
  text(): Promise<string>;
  json(): Promise<unknown>;
}
`;

export function MonacoTestEditor({
  code,
  language,
  onChange,
  readOnly = false,
  theme = 'auto',
  height = '400px',
  showMinimap = true,
  showLineNumbers = true,
  wordWrap = 'on',
  fontSize = 14,
  onSave,
  onCopy,
  onDownload,
  className = '',
}: MonacoTestEditorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [editorValue, setEditorValue] = useState(code);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);

  // Determine theme based on system preference or explicit setting
  const [resolvedTheme, setResolvedTheme] = useState<'vs-dark' | 'vs-light'>('vs-dark');

  useEffect(() => {
    if (theme === 'auto') {
      // Check system preference
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setResolvedTheme(isDark ? 'vs-dark' : 'vs-light');

      // Also check if the document has dark class (Tailwind dark mode)
      if (document.documentElement.classList.contains('dark')) {
        setResolvedTheme('vs-dark');
      }
    } else {
      setResolvedTheme(theme);
    }
  }, [theme]);

  // Update editor value when code prop changes
  useEffect(() => {
    setEditorValue(code);
  }, [code]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setIsLoading(false);

    // Add Playwright type definitions for better intellisense
    monaco.languages.typescript.typescriptDefaults.setExtraLibs([
      {
        content: playwrightTypes,
        filePath: 'file:///node_modules/@playwright/test/index.d.ts',
      },
    ]);

    monaco.languages.typescript.javascriptDefaults.setExtraLibs([
      {
        content: playwrightTypes,
        filePath: 'file:///node_modules/@playwright/test/index.d.ts',
      },
    ]);

    // Configure TypeScript compiler options
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      allowNonTsExtensions: true,
      lib: ['esnext', 'dom'],
      strict: true,
      noEmit: true,
    });

    // Configure JavaScript compiler options
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      allowNonTsExtensions: true,
      lib: ['esnext', 'dom'],
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (onSave) {
        onSave(editor.getValue());
      }
    });

    // Format document shortcut
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      editor.getAction('editor.action.formatDocument')?.run();
    });
  };

  const handleEditorChange: OnChange = (value) => {
    if (value !== undefined) {
      setEditorValue(value);
      if (onChange) {
        onChange(value);
      }
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editorValue);
    if (onCopy) {
      onCopy();
    }
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    }
  };

  const handleFormat = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave(editorValue);
    }
  };

  return (
    <div className={`rounded-lg border border-border overflow-hidden bg-card ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {language === 'typescript' ? 'TypeScript' : 'JavaScript'}
          </span>
          <span className="text-xs text-muted-foreground/70">
            {readOnly ? '(Read-only)' : '(Editable)'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!readOnly && (
            <>
              <button
                onClick={handleFormat}
                className="px-2 py-1 rounded text-xs bg-background hover:bg-muted border border-border text-muted-foreground transition-colors flex items-center gap-1"
                title="Format code (Shift+Alt+F)"
              >
                <AlignLeft className="w-3.5 h-3.5" />
                Format
              </button>
              {onSave && (
                <button
                  onClick={handleSave}
                  className="px-2 py-1 rounded text-xs bg-background hover:bg-muted border border-border text-muted-foreground transition-colors flex items-center gap-1"
                  title="Save (Ctrl+S)"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save
                </button>
              )}
            </>
          )}
          {onDownload && (
            <button
              onClick={handleDownload}
              className="px-2 py-1 rounded text-xs bg-background hover:bg-muted border border-border text-muted-foreground transition-colors flex items-center gap-1"
              title="Download file"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          )}
          <button
            onClick={handleCopy}
            className="px-2 py-1 rounded text-xs bg-background hover:bg-muted border border-border text-muted-foreground transition-colors flex items-center gap-1"
            title="Copy to clipboard"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center bg-muted/30" style={{ height }}>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="animate-spin h-5 w-5" />
            <span className="text-sm">Loading Monaco Editor...</span>
          </div>
        </div>
      )}

      {/* Monaco Editor */}
      <div style={{ height, display: isLoading ? 'none' : 'block' }}>
        <Editor
          height="100%"
          language={language}
          value={editorValue}
          theme={resolvedTheme}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            readOnly,
            minimap: { enabled: showMinimap },
            lineNumbers: showLineNumbers ? 'on' : 'off',
            wordWrap,
            fontSize,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
            fontLigatures: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            renderWhitespace: 'selection',
            bracketPairColorization: {
              enabled: true,
            },
            guides: {
              bracketPairs: true,
              indentation: true,
            },
            padding: {
              top: 12,
              bottom: 12,
            },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            folding: true,
            foldingHighlight: true,
            showFoldingControls: 'mouseover',
            quickSuggestions: !readOnly,
            suggestOnTriggerCharacters: !readOnly,
            parameterHints: {
              enabled: !readOnly,
            },
            hover: {
              enabled: true,
              delay: 300,
            },
            contextmenu: true,
            mouseWheelZoom: true,
            renderLineHighlight: readOnly ? 'none' : 'line',
            selectionHighlight: true,
            occurrencesHighlight: 'singleFile',
          }}
          loading={null} // We handle loading ourselves
        />
      </div>
    </div>
  );
}

export default MonacoTestEditor;
