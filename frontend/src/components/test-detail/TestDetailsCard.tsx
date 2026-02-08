// Feature #48: TestDetailsCard component extracted from TestDetailPage.tsx

interface TestType {
 id?: string;
 name?: string;
 description?: string;
 test_type?: string;
 target_url?: string;
 viewport_width?: number;
 viewport_height?: number;
 viewport_preset?: string;
 multi_viewport?: boolean;
 viewports?: (string | { name: string; width: number; height: number })[];
 wait_for_selector?: string;
 wait_time?: number;
 hide_selectors?: string;
 remove_selectors?: string;
 diff_threshold?: number;
 diff_threshold_mode?: 'percentage' | 'pixel_count';
 diff_pixel_threshold?: number;
 anti_aliasing_tolerance?: 'off' | 'low' | 'medium' | 'high';
 color_threshold?: number;
 ignore_regions?: { id: string; x: number; y: number; width: number; height: number; name?: string }[];
 ignore_selectors?: string[];
 wcag_level?: string;
 include_best_practices?: boolean;
 include_experimental?: boolean;
 include_pa11y?: boolean;
 a11y_fail_on_any?: boolean;
 a11y_fail_on_critical?: number;
 a11y_fail_on_serious?: number;
 a11y_fail_on_moderate?: number;
 a11y_fail_on_minor?: number;
 created_at?: string;
 updated_at?: string;
}

interface TestDetailsCardProps {
 test: TestType | null;
 suiteName?: string;
 formatDate: (date: string) => string;
}

// Viewport presets for visual regression tests
const viewportPresets: Record<string, { width: number; height: number; label: string }> = {
 'iPhone 14': { width: 390, height: 844, label: 'iPhone 14' },
 'iPhone SE': { width: 375, height: 667, label: 'iPhone SE' },
 'Pixel 7': { width: 412, height: 915, label: 'Pixel 7' },
 'Galaxy S21': { width: 360, height: 800, label: 'Galaxy S21' },
 'iPad': { width: 768, height: 1024, label: 'iPad' },
 'iPad Pro': { width: 1024, height: 1366, label: 'iPad Pro' },
 'MacBook 13"': { width: 1440, height: 900, label: 'MacBook 13"' },
 'Desktop HD': { width: 1920, height: 1080, label: 'Desktop HD' },
 'Desktop 4K': { width: 3840, height: 2160, label: 'Desktop 4K' },
 'mobile': { width: 375, height: 667, label: 'Mobile' },
 'tablet': { width: 768, height: 1024, label: 'Tablet' },
 'desktop': { width: 1920, height: 1080, label: 'Desktop' },
 'desktop-hd': { width: 1920, height: 1080, label: 'Desktop HD' },
 'mobile-medium': { width: 390, height: 844, label: 'Mobile Medium' },
 'mobile-large': { width: 428, height: 926, label: 'Mobile Large' },
 'mobile-small': { width: 320, height: 568, label: 'Mobile Small' },
 'mobile-android': { width: 412, height: 915, label: 'Android' },
 'mobile-android-small': { width: 360, height: 800, label: 'Android Small' },
 'mobile-landscape': { width: 844, height: 390, label: 'Mobile Landscape' },
 'tablet-portrait': { width: 768, height: 1024, label: 'Tablet Portrait' },
 'tablet-landscape': { width: 1024, height: 768, label: 'Tablet Landscape' },
 'tablet-pro-portrait': { width: 1024, height: 1366, label: 'iPad Pro Portrait' },
 'tablet-pro-landscape': { width: 1366, height: 1024, label: 'iPad Pro Landscape' },
 'desktop-medium': { width: 1440, height: 900, label: 'Desktop Medium' },
 'desktop-small': { width: 1280, height: 720, label: 'Desktop Small' },
 'desktop-large': { width: 1920, height: 1080, label: 'Desktop Large' },
 'desktop-4k': { width: 3840, height: 2160, label: 'Desktop 4K' },
 'desktop-ultrawide': { width: 2560, height: 1080, label: 'Ultrawide' },
 'laptop': { width: 1366, height: 768, label: 'Laptop' },
 'desktop_hd': { width: 1280, height: 720, label: 'Desktop HD' },
 'mobile_large': { width: 414, height: 896, label: 'Mobile Large' },
};

function TestTypeBadge({ testType }: { testType?: string }) {
 if (testType === 'visual_regression') {
 return (
 <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
 📸 Visual Regression
 </span>
 );
 }
 if (testType === 'lighthouse') {
 return (
 <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
 ⚡ Performance
 </span>
 );
 }
 if (testType === 'load') {
 return (
 <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
 🔥 Load Test
 </span>
 );
 }
 if (testType === 'accessibility') {
 return (
 <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
 ♿ Accessibility
 </span>
 );
 }
 return (
 <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
 🔄 E2E Test
 </span>
 );
}

export function TestDetailsCard({ test, suiteName, formatDate }: TestDetailsCardProps) {
 return (
 <div className="rounded-lg border border-border bg-card p-6">
 <h2 className="text-lg font-semibold text-foreground">Test Details</h2>
 <dl className="mt-4 space-y-3">
 <div>
 <dt className="text-sm font-medium text-muted-foreground">ID</dt>
 <dd className="text-foreground">{test?.id}</dd>
 </div>
 <div>
 <dt className="text-sm font-medium text-muted-foreground">Type</dt>
 <dd className="text-foreground">
 <TestTypeBadge testType={test?.test_type} />
 </dd>
 </div>
 <div>
 <dt className="text-sm font-medium text-muted-foreground">Suite</dt>
 <dd className="text-foreground">{suiteName}</dd>
 </div>

 {/* Visual Regression Test Details */}
 {test?.test_type === 'visual_regression' && test?.target_url && (
 <div>
 <dt className="text-sm font-medium text-muted-foreground">Target URL</dt>
 <dd className="text-foreground break-all">
 <a href={test.target_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
 {test.target_url}
 </a>
 </dd>
 </div>
 )}

 {test?.test_type === 'visual_regression' && test?.multi_viewport && test?.viewports && test.viewports.length > 0 && (
 <div>
 <dt className="text-sm font-medium text-muted-foreground">Viewports (Multi-viewport Mode)</dt>
 <dd className="text-foreground">
 <div className="flex flex-wrap gap-1.5">
 {test.viewports.map((vp, idx) => {
 if (typeof vp === 'object' && vp !== null) {
 return (
 <span key={`${vp.name}-${idx}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
 📐 {vp.name} ({vp.width}×{vp.height})
 </span>
 );
 }
 const vpString = vp as string;
 const preset = viewportPresets[vpString];
 return (
 <span key={vpString} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
 📐 {preset?.label || vpString} ({preset?.width || '?'}×{preset?.height || '?'})
 </span>
 );
 })}
 </div>
 </dd>
 </div>
 )}

 {test?.test_type === 'visual_regression' && !test?.multi_viewport && (test?.viewport_width || test?.viewport_preset) && (
 <div>
 <dt className="text-sm font-medium text-muted-foreground">Viewport</dt>
 <dd className="text-foreground">
 {test.viewport_preset && test.viewport_preset !== 'custom' ? (
 <span className="capitalize">{test.viewport_preset} ({test.viewport_width}×{test.viewport_height})</span>
 ) : (
 <span>{test.viewport_width}×{test.viewport_height}</span>
 )}
 </dd>
 </div>
 )}

 {test?.test_type === 'visual_regression' && test?.wait_for_selector && (
 <div>
 <dt className="text-sm font-medium text-muted-foreground">Wait for Selector</dt>
 <dd className="text-foreground font-mono text-sm bg-muted px-2 py-1 rounded">
 {test.wait_for_selector}
 </dd>
 </div>
 )}

 {test?.test_type === 'visual_regression' && test?.wait_time && test.wait_time > 0 && (
 <div>
 <dt className="text-sm font-medium text-muted-foreground">Additional Wait</dt>
 <dd className="text-foreground">{test.wait_time}ms</dd>
 </div>
 )}

 {test?.test_type === 'visual_regression' && test?.hide_selectors && (
 <div>
 <dt className="text-sm font-medium text-muted-foreground">Hide Elements</dt>
 <dd className="text-foreground font-mono text-sm bg-muted px-2 py-1 rounded">
 {test.hide_selectors}
 </dd>
 </div>
 )}

 {test?.test_type === 'visual_regression' && test?.remove_selectors && (
 <div>
 <dt className="text-sm font-medium text-muted-foreground">Remove Elements</dt>
 <dd className="text-foreground font-mono text-sm bg-muted px-2 py-1 rounded">
 {test.remove_selectors}
 </dd>
 </div>
 )}

 {test?.test_type === 'visual_regression' && (
 <div>
 <dt className="text-sm font-medium text-muted-foreground">Diff Threshold</dt>
 <dd className="text-foreground">
 <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
 ((test.diff_threshold_mode ?? 'percentage') === 'percentage' && (test.diff_threshold ?? 0) === 0) ||
 ((test.diff_threshold_mode ?? 'percentage') === 'pixel_count' && (test.diff_pixel_threshold ?? 0) === 0)
 ? 'bg-primary/10 text-primary'
 : 'bg-warning/10 text-warning'
 }`}>
 {(test.diff_threshold_mode ?? 'percentage') === 'pixel_count'
 ? ((test.diff_pixel_threshold ?? 0) === 0 ? 'Exact match' : `${test.diff_pixel_threshold} pixel tolerance`)
 : ((test.diff_threshold ?? 0) === 0 ? 'Exact match' : `${test.diff_threshold}% tolerance`)
 }
 </span>
 </dd>
 </div>
 )}

 {test?.test_type === 'visual_regression' && (
 <div>
 <dt className="text-sm font-medium text-muted-foreground">Anti-aliasing Tolerance</dt>
 <dd className="text-foreground">
 <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
 (test.anti_aliasing_tolerance ?? 'off') === 'off'
 ? 'bg-primary/10 text-primary'
 : (test.anti_aliasing_tolerance === 'low'
 ? 'bg-success/10 text-success'
 : (test.anti_aliasing_tolerance === 'medium'
 ? 'bg-warning/10 text-warning'
 : 'bg-orange-100 text-orange-800'))
 }`}>
 {test.color_threshold !== undefined
 ? `Custom (${test.color_threshold.toFixed(2)})`
 : (test.anti_aliasing_tolerance ?? 'off') === 'off'
 ? 'Off (Strict)'
 : String(test.anti_aliasing_tolerance ?? 'off').charAt(0).toUpperCase() + String(test.anti_aliasing_tolerance ?? 'off').slice(1)
 }
 </span>
 </dd>
 </div>
 )}

 {test?.test_type === 'visual_regression' && test.ignore_regions && test.ignore_regions.length > 0 && (
 <div className="col-span-2">
 <dt className="text-sm font-medium text-muted-foreground mb-1">Ignore Regions</dt>
 <dd className="text-foreground">
 <div className="flex flex-wrap gap-1.5">
 {test.ignore_regions.map((region, idx) => (
 <span key={region.id || idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
 {region.name || `Region ${idx + 1}`}: {region.x},{region.y} ({region.width}×{region.height})
 </span>
 ))}
 </div>
 </dd>
 </div>
 )}

 {test?.test_type === 'visual_regression' && test.ignore_selectors && test.ignore_selectors.length > 0 && (
 <div className="col-span-2">
 <dt className="text-sm font-medium text-muted-foreground mb-1">Ignore Selectors</dt>
 <dd className="text-foreground">
 <div className="flex flex-wrap gap-1.5">
 {test.ignore_selectors.map((selector, idx) => (
 <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-800 font-mono">
 {selector}
 </span>
 ))}
 </div>
 </dd>
 </div>
 )}

 {/* Accessibility Test Details */}
 {test?.test_type === 'accessibility' && test?.target_url && (
 <div>
 <dt className="text-sm font-medium text-muted-foreground">Target URL</dt>
 <dd className="text-foreground break-all">
 <a href={test.target_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
 {test.target_url}
 </a>
 </dd>
 </div>
 )}

 {test?.test_type === 'accessibility' && test?.wcag_level && (
 <div>
 <dt className="text-sm font-medium text-muted-foreground">WCAG Level</dt>
 <dd className="text-foreground">
 <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
 test.wcag_level === 'AAA'
 ? 'bg-purple-100 text-purple-800'
 : test.wcag_level === 'AA'
 ? 'bg-success/10 text-success'
 : 'bg-primary/10 text-primary'
 }`}>
 Level {test.wcag_level}
 </span>
 </dd>
 </div>
 )}

 {test?.test_type === 'accessibility' && (
 <div>
 <dt className="text-sm font-medium text-muted-foreground">Options</dt>
 <dd className="text-foreground flex flex-wrap gap-2">
 {test.include_best_practices !== false && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800">
 ✓ Best Practices
 </span>
 )}
 {test.include_experimental === true && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-warning/10 text-warning">
 🧪 Experimental
 </span>
 )}
 {test.include_pa11y === true && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
 🔍 Pa11y
 </span>
 )}
 </dd>
 </div>
 )}

 {test?.test_type === 'accessibility' && (
 <div className="col-span-2">
 <dt className="text-sm font-medium text-muted-foreground mb-1">Pass/Fail Threshold</dt>
 <dd className="text-foreground">
 {test.a11y_fail_on_any ? (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive">
 🚫 Fail on ANY violation
 </span>
 ) : (
 <div className="flex flex-wrap gap-2">
 {test.a11y_fail_on_critical !== undefined && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive">
 🔴 Critical: {test.a11y_fail_on_critical === 0 ? 'Fail on any' : `max ${test.a11y_fail_on_critical}`}
 </span>
 )}
 {test.a11y_fail_on_serious !== undefined && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
 🟠 Serious: {test.a11y_fail_on_serious === 0 ? 'Fail on any' : `max ${test.a11y_fail_on_serious}`}
 </span>
 )}
 {test.a11y_fail_on_moderate !== undefined && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-warning/10 text-warning">
 🟡 Moderate: {test.a11y_fail_on_moderate === 0 ? 'Fail on any' : `max ${test.a11y_fail_on_moderate}`}
 </span>
 )}
 {test.a11y_fail_on_minor !== undefined && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
 🔵 Minor: {test.a11y_fail_on_minor === 0 ? 'Fail on any' : `max ${test.a11y_fail_on_minor}`}
 </span>
 )}
 {test.a11y_fail_on_critical === undefined && test.a11y_fail_on_serious === undefined &&
 test.a11y_fail_on_moderate === undefined && test.a11y_fail_on_minor === undefined && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground">
 Default: Fail on Critical/Serious
 </span>
 )}
 </div>
 )}
 </dd>
 </div>
 )}

 <div>
 <dt className="text-sm font-medium text-muted-foreground">Created</dt>
 <dd className="text-foreground">
 {test?.created_at ? formatDate(test.created_at) : '-'}
 </dd>
 </div>
 <div>
 <dt className="text-sm font-medium text-muted-foreground">Updated</dt>
 <dd className="text-foreground">
 {test?.updated_at ? formatDate(test.updated_at) : '-'}
 </dd>
 </div>
 </dl>
 </div>
 );
}
