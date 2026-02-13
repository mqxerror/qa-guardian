# Design Patterns & Color System

> A reusable reference for the dark-first design system used in QA-Dam3oun's Quick Test page.
> Copy this file into any new project to replicate the same look and feel.

---

## Table of Contents

1. [Philosophy: Dark-First](#1-philosophy-dark-first)
2. [Global CSS Variables](#2-global-css-variables)
3. [Semantic Color Tokens](#3-semantic-color-tokens)
4. [Tailwind Utility Patterns](#4-tailwind-utility-patterns)
5. [Component Architecture](#5-component-architecture)
6. [Score Color System](#6-score-color-system)
7. [Status-Based Styling](#7-status-based-styling)
8. [Layout Patterns](#8-layout-patterns)
9. [Typography](#9-typography)
10. [Icons](#10-icons)
11. [Interactive States](#11-interactive-states)
12. [Accessibility](#12-accessibility)
13. [Theme Palette Overrides](#13-theme-palette-overrides)

---

## 1. Philosophy: Dark-First

The design system uses a **dark-first** approach:

- `:root` defines the **dark theme** (default)
- `.light` class on `<html>` opts into the light theme
- All Tailwind classes use semantic tokens (`bg-background`, `text-foreground`, etc.) — never hardcoded colors like `bg-gray-900`
- This means every component automatically supports both themes with zero additional work

**Why dark-first?**
- Developer/QA tools are predominantly used in dark environments
- Dark backgrounds reduce eye strain during long testing sessions
- Accent colors (success green, destructive red) pop more on dark backgrounds
- The `hsl()` color system makes opacity variants trivial (`bg-primary/10`, `bg-success/20`)

---

## 2. Global CSS Variables

Place these in your `index.css` (or `globals.css`) inside `@layer base`:

### Dark Theme (Default — `:root`)

```css
@layer base {
  :root {
    /* Surfaces */
    --background: 224 10% 8%;         /* #131518 — deepest background */
    --foreground: 210 20% 92%;        /* #E8ECF0 — primary text */
    --card: 224 10% 11%;              /* #1A1D22 — card surfaces */
    --card-foreground: 210 20% 92%;   /* same as foreground */
    --popover: 224 10% 11%;           /* matches card */
    --popover-foreground: 210 20% 92%;

    /* Brand */
    --primary: 217 91% 60%;           /* #4D8BF5 — electric blue */
    --primary-foreground: 210 20% 98%;

    /* Neutral layers */
    --secondary: 220 10% 18%;         /* #2A2D33 — elevated surfaces */
    --secondary-foreground: 210 20% 92%;
    --muted: 220 10% 15%;             /* #232629 — subtle backgrounds */
    --muted-foreground: 215 15% 55%;  /* #7D8A9A — secondary text */
    --accent: 220 10% 18%;            /* same as secondary */
    --accent-foreground: 210 20% 92%;

    /* Feedback */
    --destructive: 0 72% 51%;         /* red — errors/failures */
    --destructive-foreground: 210 20% 98%;
    --success: 142 76% 36%;           /* green — passed/good */
    --success-foreground: 210 20% 98%;
    --warning: 38 92% 50%;            /* amber — warnings/medium */
    --warning-foreground: 20 14% 4%;
    --info: 199 89% 48%;              /* cyan — informational */
    --info-foreground: 210 20% 98%;

    /* Structural */
    --border: 220 10% 18%;            /* #2A2D33 — subtle borders */
    --input: 220 10% 18%;             /* input backgrounds */
    --ring: 217 91% 60%;              /* focus ring = primary */
    --radius: 0.5rem;                 /* 8px border radius default */

    /* Sidebar */
    --sidebar-background: 224 10% 6%;
    --sidebar-foreground: 210 20% 92%;
    --sidebar-primary: 217 91% 60%;
    --sidebar-primary-foreground: 210 20% 98%;
    --sidebar-accent: 220 10% 12%;
    --sidebar-accent-foreground: 210 20% 92%;
    --sidebar-border: 220 10% 15%;
    --sidebar-ring: 217 91% 60%;
  }
}
```

### Light Theme (Opt-In — `.light`)

```css
.light {
  --background: 0 0% 100%;           /* pure white */
  --foreground: 222.2 84% 4.9%;      /* near-black */
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;      /* slightly darker blue */
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 40%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;

  /* Status colors stay the same in both themes */
  --success: 142 76% 36%;
  --success-foreground: 210 20% 98%;
  --warning: 38 92% 50%;
  --warning-foreground: 20 14% 4%;
  --info: 199 89% 48%;
  --info-foreground: 210 20% 98%;
}
```

### Base Styles

```css
@layer base {
  * {
    border-color: hsl(var(--border));
  }
  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
  }
}
```

---

## 3. Semantic Color Tokens

Never use raw Tailwind colors. Always use semantic tokens:

| Token | Dark Hex | Purpose | Tailwind Classes |
|-------|----------|---------|-----------------|
| `background` | `#131518` | Page background | `bg-background` |
| `foreground` | `#E8ECF0` | Primary text | `text-foreground` |
| `card` | `#1A1D22` | Card/panel surfaces | `bg-card` |
| `muted` | `#232629` | Subtle backgrounds, input fields | `bg-muted` |
| `muted-foreground` | `#7D8A9A` | Secondary/helper text | `text-muted-foreground` |
| `primary` | `#4D8BF5` | Brand blue, CTAs, focus rings | `bg-primary`, `text-primary` |
| `primary-foreground` | `#F8FAFC` | Text on primary buttons | `text-primary-foreground` |
| `secondary` | `#2A2D33` | Elevated surfaces | `bg-secondary` |
| `border` | `#2A2D33` | All borders | `border-border` |
| `destructive` | `#D32F2F` | Errors, failures, delete | `text-destructive`, `bg-destructive` |
| `success` | `#22C55E` | Passed, good scores | `text-success`, `bg-success` |
| `warning` | `#F59E0B` | Warnings, medium scores | `text-warning`, `bg-warning` |
| `info` | `#0EA5E9` | Informational highlights | `text-info`, `bg-info` |

### Opacity Variants (HSL Power)

Because variables use HSL format, Tailwind's opacity modifier works natively:

```html
<!-- 10% opacity primary background (used for active wave cards) -->
<div class="bg-primary/10">

<!-- 20% opacity success background (used for score cards) -->
<div class="bg-success/20">

<!-- 50% opacity muted background (used for hover states) -->
<div class="bg-muted/50 hover:bg-muted/70">
```

---

## 4. Tailwind Utility Patterns

### Input Fields

```html
<input class="w-full px-4 py-3 rounded-lg bg-muted border border-border text-lg font-mono
  focus:outline-none focus:ring-2 focus:ring-primary
  placeholder:text-muted-foreground
  disabled:opacity-50 disabled:cursor-not-allowed" />
```

Key patterns:
- `bg-muted` for input background (not `bg-background` — needs contrast)
- `border-border` for subtle borders
- `focus:ring-2 focus:ring-primary` for focus indication
- `font-mono` for URL/code inputs
- Error state: swap `border-border` for `border-destructive`

### Primary Buttons

```html
<button class="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium
  hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed
  flex items-center gap-2 transition-colors">
  <Zap class="w-5 h-5" />
  Test
</button>
```

### Ghost/Muted Buttons

```html
<button class="px-4 py-2 bg-muted text-muted-foreground rounded-lg
  hover:bg-muted/80 transition-colors flex items-center gap-2">
  <History class="w-5 h-5" />
  History
</button>
```

### Error Messages

```html
<div class="flex items-center gap-2 text-destructive text-sm">
  <AlertCircle class="w-4 h-4" />
  Error message here
</div>
```

### Warning Messages

```html
<div class="flex items-center gap-2 text-warning text-sm">
  <AlertCircle class="w-4 h-4" />
  Warning message here
</div>
```

### Info Banners

```html
<div class="p-4 rounded-lg bg-warning/5 border border-warning/20">
  <div class="flex items-start gap-3">
    <AlertTriangle class="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
    <div>
      <p class="text-sm font-medium text-foreground">Title</p>
      <p class="text-xs text-muted-foreground mt-1">Description text</p>
    </div>
  </div>
</div>
```

### Dropdown Menus

```html
<div class="bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
  <button class="w-full px-4 py-2.5 text-sm text-left hover:bg-muted
    flex items-center gap-2 transition-colors">
    <Icon class="w-4 h-4 text-blue-500" />
    Menu Item
  </button>
</div>
```

---

## 5. Component Architecture

### Card (Base)

The lowest-level card component. All other cards build on this.

```tsx
<Card className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
  <CardContent className="p-6">
    {children}
  </CardContent>
</Card>
```

### AnimatedCard (Standard)

Wraps `Card` with entry animations and visual hierarchy variants:

```tsx
<AnimatedCard variant="primary">       {/* default — bg-card, hover border */}
<AnimatedCard variant="hero">          {/* gradient primary background */}
<AnimatedCard variant="secondary">     {/* muted/50 background */}
<AnimatedCard variant="interactive">   {/* hover effects + cursor pointer */}
```

Variant styles:
| Variant | Background | Border | Hover |
|---------|-----------|--------|-------|
| `hero` | `bg-gradient-to-br from-primary/10 to-card` | `border-primary/20` | — |
| `primary` | `bg-card` | `border-border` | `hover:border-primary/30` |
| `secondary` | `bg-muted/50` | `border-border/50` | — |
| `interactive` | `bg-card` | `border-border` | `hover:bg-muted/50 hover:border-primary/30 hover:shadow-lg` |

Supports stagger animations:
```tsx
{items.map((item, i) => (
  <AnimatedCard key={item.id} staggerIndex={i}>
    ...
  </AnimatedCard>
))}
```

### WaveProgressCard (Status Card)

A card with status-driven borders, expand/collapse, and step tracking:

```tsx
<WaveProgressCard
  status="running"           // waiting | running | completed | failed | skipped
  icon={Globe}               // Lucide icon component
  title="Health Check"
  subtitle="In progress..."  // or auto-generated from status
  expanded={isExpanded}
  onToggle={() => toggle()}
  steps={[
    { name: 'DNS Resolution', status: 'completed' },
    { name: 'HTTP Request', status: 'running' },
    { name: 'SSL Certificate', status: 'pending' },
  ]}
>
  {/* Optional extra content when expanded */}
</WaveProgressCard>
```

Status-driven border colors:
| Status | Border | Background |
|--------|--------|------------|
| `waiting` | `border-muted` | `bg-muted/10` |
| `running` | `border-primary` | `bg-primary/10` + `animate-pulse` |
| `completed` | `border-success` | `bg-success/10` |
| `failed` | `border-destructive` | `bg-destructive/10` |
| `skipped` | `border-warning` | `bg-warning/10` |

### PageHeader

Consistent page headers with breadcrumbs:

```tsx
<PageHeader
  title="Quick Test"
  description="Instant URL analysis with 7 parallel test waves"
  breadcrumbs={[
    { label: 'Home', href: '/dashboard' },
    { label: 'Quick Test' },  // no href = current page
  ]}
  actions={<Button>Action</Button>}  // optional right-side actions
/>
```

### ScoreCard

Color-coded score display with configurable thresholds:

```tsx
<ScoreCard score={85} label="Health" />
<ScoreCard score={45} label="Security" thresholds={{ good: 70, warning: 50 }} />
<ScoreCard score={100} label="Performance" size="lg" showIcon />

{/* Or as a grid: */}
<ScoreCardGrid
  items={[
    { score: 100, label: 'Health' },
    { score: 88, label: 'Performance' },
    { score: 72, label: 'Security' },
    { score: 90, label: 'AI' },
  ]}
/>
```

---

## 6. Score Color System

Scores (0-100) are color-coded using a three-tier threshold system:

| Range | Color Token | Tailwind Class | Hex (Dark) | Meaning |
|-------|------------|---------------|------------|---------|
| >= 80 | `success` | `text-success` / `bg-success/20` | `#22C55E` | Good |
| >= 60 | `warning` | `text-warning` / `bg-warning/20` | `#F59E0B` | Needs work |
| < 60 | `destructive` | `text-destructive` / `bg-destructive/20` | `#D32F2F` | Bad |

### Score Utility Functions

```typescript
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-warning';
  return 'text-destructive';
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-success/20';
  if (score >= 60) return 'bg-warning/20';
  return 'bg-destructive/20';
}
```

### Mini Progress Bars

Used inside score cards to visualize the value:

```html
<div class="h-1.5 rounded-full bg-muted overflow-hidden">
  <div
    class="h-full rounded-full transition-all bg-success"
    style="width: 85%"
  />
</div>
```

The fill color follows the same threshold: `bg-success` / `bg-warning` / `bg-destructive`.

---

## 7. Status-Based Styling

### Status Icons (Lucide)

| Status | Icon | Color | Animation |
|--------|------|-------|-----------|
| `waiting` / `pending` | `Clock` | `text-muted-foreground` | none |
| `running` | `Loader2` | `text-primary` | `animate-spin` |
| `completed` | `CheckCircle2` | `text-success` | none |
| `failed` | `XCircle` | `text-destructive` | none |
| `skipped` | `AlertTriangle` | `text-warning` | none |

### Status Background (Icon Container)

```html
<!-- Running state -->
<div class="p-2 rounded-lg bg-primary/20">
  <Icon class="w-5 h-5 text-primary" />
</div>

<!-- Idle/waiting state -->
<div class="p-2 rounded-lg bg-muted">
  <Icon class="w-5 h-5 text-muted-foreground" />
</div>
```

---

## 8. Layout Patterns

### Page Container

```html
<div class="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
  <!-- PageHeader -->
  <!-- Content sections -->
</div>
```

- `p-6 lg:p-8` — responsive padding
- `space-y-8` — consistent vertical rhythm between major sections
- `max-w-6xl mx-auto` — centered content, doesn't stretch on ultra-wide

### Wave Grid (2x2 → 1 column on mobile)

```html
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
  {waves.map(wave => <WaveCard key={wave.id} ... />)}
</div>
```

### Score Category Grid (responsive 2→3 columns)

```html
<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
  {categories.map(cat => (
    <div class="rounded-lg bg-muted/50 p-3 hover:bg-muted/70 transition-colors">
      ...
    </div>
  ))}
</div>
```

### URL Input Row

```html
<div class="flex flex-col gap-4">
  <div class="flex gap-3">
    <div class="relative flex-1">
      <input ... />
      <!-- Dropdown positioned absolutely below -->
    </div>
    <select ... />     <!-- Browser selector -->
    <button ... />     <!-- Primary CTA -->
    <button ... />     <!-- Icon button (History) -->
  </div>
</div>
```

### Action Button Row (right-aligned)

```html
<div class="flex gap-3 justify-end">
  <button class="px-4 py-2 bg-muted ...">Export</button>
  <button class="px-4 py-2 bg-muted ...">Save</button>
  <button class="px-4 py-2 bg-primary ...">Primary Action</button>
</div>
```

---

## 9. Typography

| Element | Classes | Usage |
|---------|---------|-------|
| Page title | `text-2xl font-bold tracking-tight` | PageHeader h1 |
| Section title | `text-xl font-semibold text-foreground` | Card section headings |
| Card title | `font-medium text-foreground` | WaveCard title |
| Body text | `text-sm text-foreground` | Step names, content |
| Helper text | `text-sm text-muted-foreground` | Descriptions, subtitles |
| Tiny label | `text-xs text-muted-foreground` | Weights, timestamps |
| Score (overall) | `text-5xl font-bold` + score color | Main score display |
| Score (category) | `text-2xl font-bold` + score color | Category scores |
| Monospace | `text-lg font-mono` | URL input fields |

---

## 10. Icons

The design system uses **Lucide React** icons exclusively.

### Icon Sizing Convention

| Context | Size | Class |
|---------|------|-------|
| Inline with text | 16px | `w-4 h-4` |
| Button icon | 20px | `w-5 h-5` |
| Card header icon | 20px | `w-5 h-5` |
| Step status icon | 14px | `w-3.5 h-3.5` |

### Common Icons Used

| Purpose | Icon | Import |
|---------|------|--------|
| URL/Web | `Globe` | `lucide-react` |
| Performance | `Gauge` | `lucide-react` |
| Security | `Shield` | `lucide-react` |
| AI/Brain | `Brain` | `lucide-react` |
| Accessibility | `Accessibility` | `lucide-react` |
| Network/API | `Network` | `lucide-react` |
| SEO/Search | `Search` | `lucide-react` |
| Lightning/CTA | `Zap` | `lucide-react` |
| Loading | `Loader2` | `lucide-react` (+ `animate-spin`) |
| Success | `CheckCircle2` | `lucide-react` |
| Error | `XCircle` | `lucide-react` |
| Warning | `AlertTriangle` | `lucide-react` |
| Waiting | `Clock` | `lucide-react` |
| History | `History` | `lucide-react` |
| Download | `Download` | `lucide-react` |
| Save | `Save` | `lucide-react` |
| Expand | `ChevronDown` / `ChevronUp` | `lucide-react` |
| External link | `ExternalLink` | `lucide-react` |
| Schedule | `CalendarClock` | `lucide-react` |
| Compare | `ArrowLeftRight` | `lucide-react` |
| Chart | `BarChart2` | `lucide-react` |

---

## 11. Interactive States

### Hover Effects

```css
/* Cards */
hover:bg-muted/50
hover:border-primary/30
hover:shadow-lg hover:shadow-primary/5

/* Buttons (ghost) */
hover:bg-muted/80

/* Buttons (primary) */
hover:bg-primary/90

/* List items */
hover:bg-muted

/* Score cards */
hover:bg-muted/70
```

### Focus States

```css
focus:outline-none focus:ring-2 focus:ring-primary
```

Global CSS provides a fallback:
```css
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--ring));
}
```

### Disabled States

```css
disabled:opacity-50 disabled:cursor-not-allowed
```

### Transitions

Always add `transition-colors` or `transition-all` for smooth state changes:

```html
<div class="bg-muted/50 hover:bg-muted/70 transition-colors">
<button class="hover:bg-primary/90 transition-colors">
```

### Loading Spinner

```html
<Loader2 class="w-5 h-5 animate-spin" />
```

### Animated Pulse (Running State)

```html
<div class="animate-pulse border-primary bg-primary/10">
```

---

## 12. Accessibility

### Reduced Motion

Always respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

In React, use the `useReducedMotion()` hook to conditionally apply animations:

```tsx
const prefersReducedMotion = useReducedMotion();
// Skip animation classes when true
```

### ARIA Attributes

```html
<button aria-expanded={isExpanded} onClick={toggle}>
```

### Contrast

The HSL color system ensures sufficient contrast:
- `foreground` on `background`: ~12:1 ratio
- `muted-foreground` on `background`: ~4.5:1 ratio (meets AA)
- `primary-foreground` on `primary`: ~8:1 ratio
- Status colors (`success`, `warning`, `destructive`) on their `/10` or `/20` backgrounds: all pass AA

### Custom Scrollbar (Dark Theme)

```css
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.3);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.5);
}
```

---

## 13. Theme Palette Overrides

The system supports swappable accent colors via `data-theme-palette` on `<html>`:

```html
<html data-theme-palette="purple">  <!-- overrides --primary -->
```

Available palettes:

| Palette | `--primary` HSL | Hex | Vibe |
|---------|----------------|-----|------|
| Default (blue) | `217 91% 60%` | `#4D8BF5` | Professional, trustworthy |
| `purple` | `271 81% 56%` | `#A855F7` | Creative, modern |
| `emerald` | `160 84% 39%` | `#10B981` | Fresh, growth |
| `orange` | `24 95% 53%` | `#F97316` | Energetic, warm |
| `rose` | `350 89% 60%` | `#F43F5E` | Bold, passionate |
| `mono` | `0 0% 70%` | `#B3B3B3` | Minimal, neutral |

Each palette overrides: `--primary`, `--primary-foreground`, `--accent`, `--accent-foreground`, `--ring`, and sidebar variants. All other tokens (surfaces, text, status colors) remain unchanged — your entire UI recolors with a single attribute.

---

## Quick Start: Applying This System to a New Project

1. **Copy the CSS variables** from Section 2 into your `index.css`
2. **Configure Tailwind** to use these CSS variables (add to `tailwind.config.js`):
   ```js
   theme: {
     extend: {
       colors: {
         background: 'hsl(var(--background))',
         foreground: 'hsl(var(--foreground))',
         card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
         primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
         secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
         muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
         accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
         destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
         success: { DEFAULT: 'hsl(var(--success))', foreground: 'hsl(var(--success-foreground))' },
         warning: { DEFAULT: 'hsl(var(--warning))', foreground: 'hsl(var(--warning-foreground))' },
         info: { DEFAULT: 'hsl(var(--info))', foreground: 'hsl(var(--info-foreground))' },
         border: 'hsl(var(--border))',
         input: 'hsl(var(--input))',
         ring: 'hsl(var(--ring))',
       },
       borderRadius: { lg: 'var(--radius)' },
     },
   }
   ```
3. **Install Lucide React**: `npm install lucide-react`
4. **Use semantic classes** everywhere — never hardcode colors
5. **Copy component patterns** from Section 5 as starting points

---

*Generated from QA-Dam3oun's Quick Test page design system. Last updated: February 2026.*
