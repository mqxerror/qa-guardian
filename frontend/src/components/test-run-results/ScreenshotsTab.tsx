/**
 * ScreenshotsTab Component
 * Feature #46: Extracted from TestRunResultPage.tsx for modularity
 *
 * Displays all screenshots captured during a test run with:
 * - Grid and Carousel view modes
 * - Side-by-side comparison mode
 * - Filtering by test type (E2E, Visual, Performance, Load, Accessibility)
 * - Collapsible groups by test type
 * - Lightbox modal with navigation
 * - Download individual or all screenshots as ZIP
 */

import React from 'react';
import { formatStepTime } from './utils';
import { GalleryViewMode, ScreenshotTypeFilter } from './types';

// Screenshot item interface (matches the one in TestRunResultPage)
export interface ScreenshotItem {
 id: string;
 url: string;
 title: string;
 type: 'final' | 'baseline' | 'diff' | 'step_before' | 'step_after';
 testName: string;
 testId: string;
 testStatus: 'passed' | 'failed' | 'error' | 'skipped';
 testType: 'E2E' | 'Visual' | 'Performance' | 'Load' | 'Accessibility';
 stepIndex?: number;
 stepAction?: string;
 timestamp?: number;
 viewport?: { width: number; height: number };
 diffPercentage?: number;
}

export interface ScreenshotsTabProps {
 // Screenshot data
 allScreenshots: ScreenshotItem[];
 browser?: string;

 // View mode state
 galleryViewMode: GalleryViewMode;
 setGalleryViewMode: (mode: GalleryViewMode) => void;

 // Comparison mode state
 comparisonMode: boolean;
 setComparisonMode: (mode: boolean) => void;
 selectedForComparison: string[];
 setSelectedForComparison: (ids: string[] | ((prev: string[]) => string[])) => void;

 // Lightbox state
 lightboxIndex: number;
 lightboxOpen: boolean;
 setLightboxIndex: (index: number | ((prev: number) => number)) => void;
 setLightboxOpen: (open: boolean) => void;

 // Collapsed groups state
 collapsedGroups: Set<string>;
 setCollapsedGroups: (groups: Set<string> | ((prev: Set<string>) => Set<string>)) => void;

 // Filter state
 screenshotTypeFilter: ScreenshotTypeFilter;
 setScreenshotTypeFilter: (filter: ScreenshotTypeFilter) => void;

 // Download state and functions
 downloadingZip: boolean;
 downloadAllAsZip: () => void;
 downloadGroupAsZip: (testType: string, screenshots: ScreenshotItem[]) => void;
 downloadScreenshot: (screenshot: ScreenshotItem) => void;

 // Utility functions
 getScreenshotTypeBadge: (type: ScreenshotItem['type']) => string;
 openLightbox: (index: number) => void;
 navigateLightbox: (direction: 'prev' | 'next') => void;
 toggleComparisonSelect: (id: string) => void;

 // Tab navigation (for View Test feature)
 setActiveTab: (tab: string) => void;
}

const ScreenshotsTab: React.FC<ScreenshotsTabProps> = ({
 allScreenshots,
 browser,
 galleryViewMode,
 setGalleryViewMode,
 comparisonMode,
 setComparisonMode,
 selectedForComparison,
 setSelectedForComparison,
 lightboxIndex,
 lightboxOpen,
 setLightboxIndex,
 setLightboxOpen,
 collapsedGroups,
 setCollapsedGroups,
 screenshotTypeFilter,
 setScreenshotTypeFilter,
 downloadingZip,
 downloadAllAsZip,
 downloadGroupAsZip,
 downloadScreenshot,
 getScreenshotTypeBadge,
 openLightbox,
 navigateLightbox,
 toggleComparisonSelect,
 setActiveTab,
}) => {
 // Toggle group collapse
 const toggleGroup = (type: string) => {
 setCollapsedGroups(prev => {
 const newSet = new Set(prev);
 if (newSet.has(type)) {
 newSet.delete(type);
 } else {
 newSet.add(type);
 }
 return newSet;
 });
 };

 // Type labels and colors for grouping
 const typeLabels: Record<string, { label: string; icon: string; color: string }> = {
 'E2E': { label: 'E2E Tests', icon: '🧪', color: 'bg-primary' },
 'Visual': { label: 'Visual Tests', icon: '🎨', color: 'bg-purple-500' },
 'Performance': { label: 'Performance Tests', icon: '⚡', color: 'bg-warning' },
 'Load': { label: 'Load Tests', icon: '📊', color: 'bg-orange-500' },
 'Accessibility': { label: 'Accessibility Tests', icon: '♿', color: 'bg-success' },
 };

 // Filter type colors
 const typeColors: Record<string, string> = {
 'All': 'bg-gray-500',
 'E2E': 'bg-primary',
 'Visual': 'bg-purple-500',
 'Performance': 'bg-warning',
 'Load': 'bg-orange-500',
 'Accessibility': 'bg-success',
 };

 // Type order for rendering groups
 const typeOrder = ['E2E', 'Visual', 'Performance', 'Load', 'Accessibility'] as const;

 return (
 <div>
 {/* Header with controls */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
 <div>
 <h2 className="text-lg font-semibold text-foreground">Screenshots</h2>
 <p className="text-sm text-muted-foreground">
 {allScreenshots.length} screenshot{allScreenshots.length !== 1 ? 's' : ''} captured
 </p>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 {/* View mode toggle */}
 <div className="flex items-center bg-muted rounded-lg p-1">
 <button
 onClick={() => setGalleryViewMode('grid')}
 className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
 galleryViewMode === 'grid'
 ? 'bg-background text-foreground shadow-sm'
 : 'text-muted-foreground hover:text-foreground'
 }`}
 >
 <span className="flex items-center gap-1.5">
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
 </svg>
 Grid
 </span>
 </button>
 <button
 onClick={() => setGalleryViewMode('carousel')}
 className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
 galleryViewMode === 'carousel'
 ? 'bg-background text-foreground shadow-sm'
 : 'text-muted-foreground hover:text-foreground'
 }`}
 >
 <span className="flex items-center gap-1.5">
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 Carousel
 </span>
 </button>
 </div>

 {/* Comparison mode toggle */}
 <button
 onClick={() => {
 setComparisonMode(!comparisonMode);
 if (comparisonMode) setSelectedForComparison([]);
 }}
 className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
 comparisonMode
 ? 'bg-primary text-primary-foreground border-primary'
 : 'bg-background text-foreground border-border hover:bg-muted'
 }`}
 >
 <span className="flex items-center gap-1.5">
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
 </svg>
 Compare {comparisonMode && selectedForComparison.length > 0 && `(${selectedForComparison.length}/2)`}
 </span>
 </button>

 {/* Download ZIP button */}
 <button
 onClick={downloadAllAsZip}
 disabled={allScreenshots.length === 0 || downloadingZip}
 className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 >
 <span className="flex items-center gap-1.5">
 {downloadingZip ? (
 <>
 <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 Creating ZIP...
 </>
 ) : (
 <>
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
 </svg>
 Download All (ZIP)
 </>
 )}
 </span>
 </button>
 </div>
 </div>

 {/* Feature #1997: Filter buttons by test type */}
 {allScreenshots.length > 0 && (
 <div className="flex flex-wrap items-center gap-2 mb-4">
 <span className="text-sm text-muted-foreground mr-2">Filter:</span>
 {(['All', 'E2E', 'Visual', 'Performance', 'Load', 'Accessibility'] as const).map(filterType => {
 // Count screenshots for this type
 const count = filterType === 'All'
 ? allScreenshots.length
 : allScreenshots.filter(s => s.testType === filterType).length;

 // Skip types with no screenshots
 if (count === 0 && filterType !== 'All') return null;

 return (
 <button
 key={filterType}
 onClick={() => setScreenshotTypeFilter(filterType)}
 className={`px-3 py-1.5 text-sm rounded-lg border transition-colors flex items-center gap-2 ${
 screenshotTypeFilter === filterType
 ? 'bg-primary text-primary-foreground border-primary'
 : 'bg-background text-foreground border-border hover:bg-muted'
 }`}
 >
 <span className={`w-2 h-2 rounded-full ${typeColors[filterType]}`} />
 {filterType}
 <span className={`text-xs px-1.5 py-0.5 rounded ${
 screenshotTypeFilter === filterType ? 'bg-primary-foreground/20' : 'bg-muted'
 }`}>
 {count}
 </span>
 </button>
 );
 })}
 </div>
 )}

 {allScreenshots.length === 0 ? (
 <div className="text-center py-12 border border-dashed border-border rounded-lg">
 <svg className="w-12 h-12 mx-auto text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 <p className="text-muted-foreground">No screenshots captured during this run.</p>
 </div>
 ) : (
 <>
 {/* Comparison View */}
 {comparisonMode && selectedForComparison.length === 2 && (
 <div className="mb-6 border border-border rounded-lg overflow-hidden">
 <div className="p-3 bg-muted/30 border-b border-border flex items-center justify-between">
 <h3 className="font-medium text-foreground">Side-by-Side Comparison</h3>
 <button
 onClick={() => setSelectedForComparison([])}
 className="text-sm text-muted-foreground hover:text-foreground"
 >
 Clear
 </button>
 </div>
 <div className="grid grid-cols-2 gap-px bg-border">
 {selectedForComparison.map((id) => {
 const screenshot = allScreenshots.find(s => s.id === id);
 if (!screenshot) return null;
 return (
 <div key={id} className="bg-background p-4">
 <div className="flex items-center justify-between mb-2">
 <span className={`text-xs px-2 py-0.5 rounded ${getScreenshotTypeBadge(screenshot.type)}`}>
 {screenshot.type.replace('_', ' ')}
 </span>
 <button
 onClick={() => downloadScreenshot(screenshot)}
 className="text-muted-foreground hover:text-foreground"
 title="Download"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
 </svg>
 </button>
 </div>
 <p className="text-sm text-muted-foreground mb-2 truncate">{screenshot.title}</p>
 <img
 src={screenshot.url}
 alt={screenshot.title}
 className="w-full rounded border border-border"
 />
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* Grid View - Feature #1996: Grouped by test type with collapsible sections */}
 {/* Feature #1997: Filter screenshots by test type */}
 {galleryViewMode === 'grid' && (
 <div className="space-y-6">
 {/* Group screenshots by test type */}
 {(() => {
 // Feature #1997: Apply filter before grouping
 const filteredScreenshots = screenshotTypeFilter === 'All'
 ? allScreenshots
 : allScreenshots.filter(s => s.testType === screenshotTypeFilter);

 const groupedScreenshots = filteredScreenshots.reduce((acc, screenshot) => {
 const type = screenshot.testType || 'E2E';
 if (!acc[type]) acc[type] = [];
 acc[type].push(screenshot);
 return acc;
 }, {} as Record<string, typeof allScreenshots>);

 // Calculate index offset for lightbox navigation
 let globalIndex = 0;

 // Feature #1997: Show empty state when filter returns no results
 if (filteredScreenshots.length === 0) {
 return (
 <div className="text-center py-12 border border-dashed border-border rounded-lg">
 <svg className="w-12 h-12 mx-auto text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
 </svg>
 <p className="text-muted-foreground">No {screenshotTypeFilter.toLowerCase()} screenshots found.</p>
 <button
 onClick={() => setScreenshotTypeFilter('All')}
 className="mt-4 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
 >
 Show All Screenshots
 </button>
 </div>
 );
 }

 return typeOrder.map(type => {
 const screenshots = groupedScreenshots[type];
 if (!screenshots || screenshots.length === 0) return null;
 const isCollapsed = collapsedGroups.has(type);
 const typeInfo = typeLabels[type] || { label: `${type} Tests`, icon: '📷', color: 'bg-gray-500' };
 const startIndex = globalIndex;
 globalIndex += screenshots.length;

 return (
 <div key={type} className="border border-border rounded-lg overflow-hidden">
 {/* Collapsible Header - Feature #2001: Added download button */}
 <div className="flex items-center justify-between p-4 bg-muted/30">
 <button
 onClick={() => toggleGroup(type)}
 className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity"
 >
 <span className={`w-8 h-8 ${typeInfo.color} rounded-lg flex items-center justify-center text-white text-sm`}>
 {typeInfo.icon}
 </span>
 <div className="text-left">
 <h3 className="font-medium text-foreground">{typeInfo.label}</h3>
 <p className="text-xs text-muted-foreground">{screenshots.length} screenshot{screenshots.length !== 1 ? 's' : ''}</p>
 </div>
 </button>
 <div className="flex items-center gap-2">
 {/* Feature #2001: Download group button */}
 <button
 onClick={(e) => {
 e.stopPropagation();
 downloadGroupAsZip(type, screenshots);
 }}
 disabled={downloadingZip}
 className="p-2 rounded-lg bg-background border border-border hover:bg-muted transition-colors disabled:opacity-50"
 title={`Download all ${typeInfo.label.toLowerCase()} as ZIP`}
 >
 {downloadingZip ? (
 <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
 </svg>
 ) : (
 <svg className="w-4 h-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
 </svg>
 )}
 </button>
 {/* Collapse/expand indicator */}
 <button
 onClick={() => toggleGroup(type)}
 className="p-2 rounded-lg hover:bg-muted transition-colors"
 >
 <svg
 className={`w-5 h-5 text-muted-foreground transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </button>
 </div>
 </div>

 {/* Screenshots Grid */}
 {!isCollapsed && (
 <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
 {screenshots.map((screenshot, idx) => (
 <div
 key={screenshot.id}
 className={`relative group border rounded-lg overflow-hidden transition-all cursor-pointer ${
 comparisonMode && selectedForComparison.includes(screenshot.id)
 ? 'ring-2 ring-primary border-primary'
 : 'border-border hover:border-primary/50'
 }`}
 onClick={() => {
 if (comparisonMode) {
 toggleComparisonSelect(screenshot.id);
 } else {
 openLightbox(startIndex + idx);
 }
 }}
 >
 {/* Comparison checkbox */}
 {comparisonMode && (
 <div className="absolute top-2 left-2 z-10">
 <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
 selectedForComparison.includes(screenshot.id)
 ? 'bg-primary border-primary'
 : 'bg-background/80 border-border'
 }`}>
 {selectedForComparison.includes(screenshot.id) && (
 <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
 </svg>
 )}
 </div>
 </div>
 )}

 {/* Thumbnail image */}
 <div className="aspect-video bg-muted relative">
 <img
 src={screenshot.url}
 alt={screenshot.title}
 className="w-full h-full object-cover"
 loading="lazy"
 />
 {/* Feature #1998: Always-visible screenshot type badge */}
 <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded font-medium ${getScreenshotTypeBadge(screenshot.type)}`}>
 {screenshot.type.replace('_', ' ')}
 </span>
 </div>

 {/* Feature #1998: Always-visible info section with test type and name */}
 <div className="p-2 bg-muted/50">
 <div className="flex items-center gap-1.5 mb-1">
 {/* Test type badge with distinct color */}
 <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium text-white ${typeInfo.color}`}>
 {screenshot.testType}
 </span>
 {/* Screenshot status badge */}
 <span className={`text-[10px] px-1.5 py-0.5 rounded ${
 screenshot.testStatus === 'passed' ? 'bg-success/10 text-success' :
 screenshot.testStatus === 'failed' ? 'bg-destructive/10 text-destructive' :
 'bg-muted text-foreground'
 }`}>
 {screenshot.testStatus}
 </span>
 </div>
 {/* Test name */}
 <p className="text-xs text-foreground truncate" title={screenshot.title}>
 {screenshot.title}
 </p>
 {/* Timestamp */}
 {screenshot.timestamp && (
 <p className="text-[10px] text-muted-foreground">{formatStepTime(screenshot.timestamp)}</p>
 )}
 </div>

 {/* Overlay with additional info on hover */}
 <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
 <div className="absolute bottom-12 left-0 right-0 p-3">
 {screenshot.stepAction && (
 <p className="text-white/70 text-xs truncate">Step: {screenshot.stepAction}</p>
 )}
 </div>
 </div>

 {/* Download button */}
 <button
 onClick={(e) => {
 e.stopPropagation();
 downloadScreenshot(screenshot);
 }}
 className="absolute top-2 right-2 p-1.5 bg-background/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
 title="Download"
 >
 <svg className="w-4 h-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
 </svg>
 </button>

 {/* Status indicator */}
 <div className={`absolute top-2 right-10 w-2 h-2 rounded-full ${
 screenshot.testStatus === 'passed' ? 'bg-success' :
 screenshot.testStatus === 'failed' ? 'bg-destructive' :
 screenshot.testStatus === 'error' ? 'bg-destructive' :
 'bg-gray-500'
 }`} title={screenshot.testStatus} />
 </div>
 ))}
 </div>
 )}
 </div>
 );
 });
 })()}
 </div>
 )}

 {/* Carousel View */}
 {galleryViewMode === 'carousel' && (
 <div className="relative">
 <div className="border border-border rounded-lg overflow-hidden">
 {/* Main image */}
 <div
 className="aspect-video bg-muted relative cursor-pointer"
 onClick={() => openLightbox(lightboxIndex)}
 >
 <img
 src={allScreenshots[lightboxIndex]?.url}
 alt={allScreenshots[lightboxIndex]?.title}
 className="w-full h-full object-contain"
 />
 {/* Navigation arrows */}
 <button
 onClick={(e) => { e.stopPropagation(); navigateLightbox('prev'); }}
 className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-background/80 rounded-full hover:bg-background transition-colors"
 >
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); navigateLightbox('next'); }}
 className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-background/80 rounded-full hover:bg-background transition-colors"
 >
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 </button>
 </div>

 {/* Info panel */}
 <div className="p-4 bg-muted/30 border-t border-border">
 <div className="flex items-start justify-between">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <span className={`text-xs px-2 py-0.5 rounded ${getScreenshotTypeBadge(allScreenshots[lightboxIndex]?.type || 'final')}`}>
 {allScreenshots[lightboxIndex]?.type.replace('_', ' ')}
 </span>
 <span className={`text-xs px-2 py-0.5 rounded ${
 allScreenshots[lightboxIndex]?.testStatus === 'passed' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
 }`}>
 {allScreenshots[lightboxIndex]?.testStatus}
 </span>
 </div>
 <h3 className="font-medium text-foreground">{allScreenshots[lightboxIndex]?.title}</h3>
 <p className="text-sm text-muted-foreground">{allScreenshots[lightboxIndex]?.testName}</p>
 {allScreenshots[lightboxIndex]?.stepAction && (
 <p className="text-sm text-muted-foreground">
 Step {(allScreenshots[lightboxIndex]?.stepIndex || 0) + 1}: {allScreenshots[lightboxIndex]?.stepAction}
 </p>
 )}
 {allScreenshots[lightboxIndex]?.viewport && (
 <p className="text-xs text-muted-foreground mt-1">
 {allScreenshots[lightboxIndex]?.viewport?.width}x{allScreenshots[lightboxIndex]?.viewport?.height}
 </p>
 )}
 {allScreenshots[lightboxIndex]?.timestamp && (
 <p className="text-xs text-muted-foreground">
 {formatStepTime(allScreenshots[lightboxIndex]?.timestamp)}
 </p>
 )}
 {allScreenshots[lightboxIndex]?.diffPercentage !== undefined && (
 <p className="text-xs text-destructive">
 {allScreenshots[lightboxIndex]?.diffPercentage?.toFixed(2)}% difference
 </p>
 )}
 </div>
 <button
 onClick={() => downloadScreenshot(allScreenshots[lightboxIndex])}
 className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
 >
 Download
 </button>
 </div>
 </div>
 </div>

 {/* Thumbnail strip */}
 <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
 {allScreenshots.map((screenshot, idx) => (
 <button
 key={screenshot.id}
 onClick={() => setLightboxIndex(idx)}
 className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
 idx === lightboxIndex ? 'border-primary' : 'border-transparent hover:border-border'
 }`}
 >
 <img
 src={screenshot.url}
 alt={screenshot.title}
 className="w-full h-full object-cover"
 loading="lazy"
 />
 </button>
 ))}
 </div>
 <p className="text-center text-sm text-muted-foreground mt-2">
 {lightboxIndex + 1} / {allScreenshots.length}
 </p>
 </div>
 )}
 </>
 )}

 {/* Lightbox Modal */}
 {lightboxOpen && allScreenshots[lightboxIndex] && (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
 onClick={() => setLightboxOpen(false)}
 >
 <div
 role="dialog"
 aria-modal="true"
 aria-labelledby="screenshots-lightbox-title"
 className="relative max-w-[90vw] max-h-[90vh]"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Close button */}
 <button
 onClick={() => setLightboxOpen(false)}
 aria-label="Close dialog"
 className="absolute -top-10 right-0 p-2 text-white/70 hover:text-white transition-colors"
 >
 <svg className="w-6 h-6" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>

 {/* Navigation */}
 <button
 onClick={() => navigateLightbox('prev')}
 className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
 >
 <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 </button>
 <button
 onClick={() => navigateLightbox('next')}
 className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
 >
 <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 </button>

 {/* Image */}
 <img
 src={allScreenshots[lightboxIndex].url}
 alt={allScreenshots[lightboxIndex].title}
 className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg"
 />

 {/* Feature #1999: Enhanced metadata panel */}
 <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/70 to-transparent">
 <div className="text-white">
 {/* Row 1: Title and badges */}
 <div className="flex items-start justify-between mb-2">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <span className={`text-xs px-2 py-0.5 rounded ${getScreenshotTypeBadge(allScreenshots[lightboxIndex].type)}`}>
 {allScreenshots[lightboxIndex].type.replace('_', ' ')}
 </span>
 <span className={`text-xs px-2 py-0.5 rounded text-white ${
 allScreenshots[lightboxIndex].testType === 'E2E' ? 'bg-primary' :
 allScreenshots[lightboxIndex].testType === 'Visual' ? 'bg-purple-500' :
 allScreenshots[lightboxIndex].testType === 'Accessibility' ? 'bg-success' :
 allScreenshots[lightboxIndex].testType === 'Performance' ? 'bg-warning' :
 allScreenshots[lightboxIndex].testType === 'Load' ? 'bg-orange-500' :
 'bg-gray-500'
 }`}>
 {allScreenshots[lightboxIndex].testType}
 </span>
 <span className={`text-xs px-2 py-0.5 rounded ${
 allScreenshots[lightboxIndex].testStatus === 'passed' ? 'bg-success/80' : 'bg-destructive/80'
 }`}>
 {allScreenshots[lightboxIndex].testStatus}
 </span>
 </div>
 <h3 id="screenshots-lightbox-title" className="font-semibold text-lg">{allScreenshots[lightboxIndex].title}</h3>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-sm text-white/70">
 {lightboxIndex + 1} / {allScreenshots.length}
 </span>
 {/* Feature #2000: View Test button to navigate to the related test */}
 <button
 onClick={() => {
 // Close lightbox and navigate to Results tab with the test highlighted
 setLightboxOpen(false);
 setActiveTab('results');
 // Find the test result element and scroll to it
 const testId = allScreenshots[lightboxIndex].testId;
 setTimeout(() => {
 const testElement = document.querySelector(`[data-test-id="${testId}"]`);
 if (testElement) {
 testElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
 // Add a brief highlight effect
 testElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
 setTimeout(() => {
 testElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
 }, 2000);
 }
 }, 100);
 }}
 className="px-3 py-1.5 text-sm bg-primary/80 rounded-lg hover:bg-primary transition-colors flex items-center gap-1.5"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
 </svg>
 View Test
 </button>
 <button
 onClick={() => downloadScreenshot(allScreenshots[lightboxIndex])}
 className="px-3 py-1.5 text-sm bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
 >
 Download
 </button>
 </div>
 </div>

 {/* Row 2: Metadata grid */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-sm">
 {/* Test Name */}
 <div className="flex items-center gap-2">
 <span className="text-white/50">Test:</span>
 <span className="text-white/90 truncate">{allScreenshots[lightboxIndex].testName}</span>
 </div>
 {/* Step */}
 {allScreenshots[lightboxIndex].stepAction && (
 <div className="flex items-center gap-2">
 <span className="text-white/50">Step:</span>
 <span className="text-white/90 truncate">
 {(allScreenshots[lightboxIndex].stepIndex !== undefined ? `#${allScreenshots[lightboxIndex].stepIndex + 1} ` : '')}
 {allScreenshots[lightboxIndex].stepAction}
 </span>
 </div>
 )}
 {/* Timestamp */}
 {allScreenshots[lightboxIndex].timestamp && (
 <div className="flex items-center gap-2">
 <span className="text-white/50">Time:</span>
 <span className="text-white/90">{formatStepTime(allScreenshots[lightboxIndex].timestamp)}</span>
 </div>
 )}
 {/* Browser */}
 <div className="flex items-center gap-2">
 <span className="text-white/50">Browser:</span>
 <span className="text-white/90">{browser || 'chromium'}</span>
 </div>
 {/* Viewport */}
 {allScreenshots[lightboxIndex].viewport && (
 <div className="flex items-center gap-2">
 <span className="text-white/50">Viewport:</span>
 <span className="text-white/90">
 {allScreenshots[lightboxIndex].viewport?.width}x{allScreenshots[lightboxIndex].viewport?.height}
 </span>
 </div>
 )}
 {/* Diff percentage for visual tests */}
 {allScreenshots[lightboxIndex].diffPercentage !== undefined && (
 <div className="flex items-center gap-2">
 <span className="text-white/50">Diff:</span>
 <span className={`${allScreenshots[lightboxIndex].diffPercentage > 0 ? 'text-warning' : 'text-success'}`}>
 {allScreenshots[lightboxIndex].diffPercentage?.toFixed(2)}%
 </span>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* Keyboard hint */}
 <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-4 text-white/50 text-sm">
 <span>Left/Right Navigate</span>
 <span>ESC Close</span>
 </div>
 </div>
 )}
 </div>
 );
};

export default ScreenshotsTab;
