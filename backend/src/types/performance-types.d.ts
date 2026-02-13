/**
 * Performance API Type Augmentations
 * Feature #699: Proper types for PerformanceObserver entries
 *
 * These interfaces extend the base PerformanceEntry with
 * browser-specific properties used in Core Web Vitals measurements.
 */

/**
 * LayoutShift entry from the layout-shift PerformanceObserver
 * @see https://developer.mozilla.org/en-US/docs/Web/API/LayoutShift
 */
interface LayoutShift extends PerformanceEntry {
  readonly entryType: 'layout-shift';
  /** Whether the layout shift was caused by recent user input */
  readonly hadRecentInput: boolean;
  /** Last input time in milliseconds */
  readonly lastInputTime: number;
  /** Layout shift score (CLS contribution) */
  readonly value: number;
  /** Array of shifted elements */
  readonly sources?: LayoutShiftAttribution[];
}

/**
 * Attribution for elements that shifted during a LayoutShift
 */
interface LayoutShiftAttribution {
  /** DOM node that shifted (if available) */
  readonly node?: Node;
  /** Rectangle representing element position before shift */
  readonly previousRect: DOMRectReadOnly;
  /** Rectangle representing element position after shift */
  readonly currentRect: DOMRectReadOnly;
}

/**
 * PerformanceEventTiming for INP (Interaction to Next Paint) measurement
 * @see https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEventTiming
 */
interface PerformanceEventTiming extends PerformanceEntry {
  readonly entryType: 'event' | 'first-input';
  /** Duration of the event in milliseconds */
  readonly duration: number;
  /** Processing start time */
  readonly processingStart: number;
  /** Processing end time */
  readonly processingEnd: number;
  /** Whether the default was prevented */
  readonly cancelable: boolean;
  /** Target element (if available) */
  readonly target?: Node;
}

/**
 * LargestContentfulPaint entry
 * @see https://developer.mozilla.org/en-US/docs/Web/API/LargestContentfulPaint
 */
interface LargestContentfulPaint extends PerformanceEntry {
  readonly entryType: 'largest-contentful-paint';
  /** Render time of the element */
  readonly renderTime: number;
  /** Load time of the element */
  readonly loadTime: number;
  /** Size of the element in pixels */
  readonly size: number;
  /** Element ID */
  readonly id: string;
  /** Element URL (for images/videos) */
  readonly url: string;
  /** The DOM element */
  readonly element?: Element;
}
