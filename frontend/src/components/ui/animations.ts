import { useEffect, useState } from "react"

/**
 * Hook to detect if user prefers reduced motion
 * Returns true if user has set prefers-reduced-motion: reduce
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    // Check on initial render
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    // Add listener for changes
    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  return prefersReducedMotion
}

/**
 * CSS animation class names for common animations
 * Use these with Tailwind's className property
 */
export const animationClasses = {
  /** Fade in from transparent */
  fadeIn: "animate-fade-in",
  /** Fade up from 20px below */
  fadeUp: "animate-fade-up",
  /** Slide in from above */
  slideIn: "animate-slide-in",
  /** Card entrance animation */
  cardEnter: "animate-card-enter",
  /** Subtle pulse for active states */
  pulseSubtle: "animate-pulse-subtle",
} as const

/**
 * Framer Motion variants for shared animations
 * Import these into components using framer-motion
 */
export const motionVariants = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3 },
  },

  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
    transition: { duration: 0.3 },
  },

  cardEnter: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 },
  },

  /** Use with staggerChildren on parent */
  staggerContainer: {
    animate: {
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  },

  /** Child items for stagger animation */
  staggerItem: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 },
  },
} as const

/**
 * Get stagger delay style for CSS animations
 * Max 8 items get staggered, rest appear instantly
 */
export function getStaggerDelay(index: number): React.CSSProperties {
  if (index >= 8) return {}
  return {
    animationDelay: `${index * 50}ms`,
    animationFillMode: "backwards",
  }
}

/**
 * Animation timing constants
 * Based on design spec: max 300ms for UI, max 500ms for page entrance
 */
export const animationTiming = {
  /** Fast UI transitions (hover, focus) */
  fast: 150,
  /** Standard UI transitions */
  normal: 300,
  /** Page entrance animations */
  entrance: 500,
  /** Stagger delay between items */
  stagger: 50,
  /** Max items to stagger (rest appear instantly) */
  maxStaggerItems: 8,
} as const
