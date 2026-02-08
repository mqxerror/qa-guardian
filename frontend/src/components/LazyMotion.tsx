/**
 * Feature #402: Lazy-load Framer Motion
 *
 * This wrapper provides lazy loading for framer-motion animations.
 * Instead of importing the full 'motion' component which adds ~40KB to the bundle,
 * we use LazyMotion with domAnimation features that are loaded on demand.
 *
 * Usage:
 * 1. Import { LazyMotionWrapper, m } from './LazyMotion'
 * 2. Wrap your animated content with <LazyMotionWrapper>
 * 3. Use <m.div> instead of <motion.div>
 */

import { LazyMotion, domAnimation, m, useMotionTemplate, useMotionValue, useAnimate, stagger, AnimatePresence, useInView, useSpring } from 'framer-motion';
import { ReactNode } from 'react';

interface LazyMotionWrapperProps {
  children: ReactNode;
}

/**
 * LazyMotionWrapper - Provides lazy-loaded framer-motion context
 *
 * Wrap any section that uses animations with this component.
 * The domAnimation features (~15KB) are loaded asynchronously.
 */
export function LazyMotionWrapper({ children }: LazyMotionWrapperProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}

// Re-export m and motion hooks for use with LazyMotion
// Feature #422: Export motion hooks alongside m for components using advanced animation features
export { m, useMotionTemplate, useMotionValue, useAnimate, stagger, AnimatePresence, useInView, useSpring };

// Export commonly used animation variants
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

export const fadeInUpReduced = {
  initial: {},
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0 },
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};
