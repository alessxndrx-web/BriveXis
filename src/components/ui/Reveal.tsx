import { createElement, ReactNode } from 'react';
import { motion, useReducedMotion, Variants } from 'motion/react';
import { DURATION, EASE, STAGGER_STEP, VIEWPORT } from '../../lib/motion';

const motionTags = {
  div: motion.div,
  ul: motion.ul,
  ol: motion.ol,
  dl: motion.dl,
  li: motion.li,
  article: motion.article,
} as const;

export type RevealTag = keyof typeof motionTags;

interface RevealProps {
  children: ReactNode;
  /** Seconds of delay before the reveal starts. */
  delay?: number;
  /** Vertical offset in pixels. Set to 0 for opacity-only reveals. */
  y?: number;
  as?: RevealTag;
  className?: string;
}

/**
 * Scroll reveal primitive: opacity 0 -> 1 with a short upward translate,
 * running once when the element enters the viewport.
 */
export function Reveal({ children, delay = 0, y = 16, as = 'div', className = '' }: RevealProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return createElement(as, { className }, children);
  }

  const Tag = motionTags[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: DURATION.reveal, delay, ease: EASE }}
    >
      {children}
    </Tag>
  );
}

interface StaggerProps {
  children: ReactNode;
  /** Seconds between siblings. */
  step?: number;
  /** Seconds before the first child starts. */
  delay?: number;
  as?: RevealTag;
  className?: string;
}

/**
 * Container for a staggered group. One viewport observer drives every child,
 * which keeps long lists cheap compared to one observer per item.
 */
export function Stagger({
  children,
  step = STAGGER_STEP,
  delay = 0,
  as = 'div',
  className = '',
}: StaggerProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return createElement(as, { className }, children);
  }

  const Tag = motionTags[as];
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: step, delayChildren: delay } },
      }}
    >
      {children}
    </Tag>
  );
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.reveal, ease: EASE } },
};

interface StaggerItemProps {
  children: ReactNode;
  as?: RevealTag;
  className?: string;
}

/** Child of `Stagger`. Inherits its timing from the parent container. */
export function StaggerItem({ children, as = 'div', className = '' }: StaggerItemProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return createElement(as, { className }, children);
  }

  const Tag = motionTags[as];
  return (
    <Tag className={className} variants={itemVariants}>
      {children}
    </Tag>
  );
}

/** Hairline that draws in from the left. Transform-only, so it never reflows. */
export function RevealLine({ className = '', delay = 0 }: { className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <span aria-hidden="true" className={`block h-px ${className}`} />;
  }

  return (
    <motion.span
      aria-hidden="true"
      className={`block h-px origin-left ${className}`}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.55, delay, ease: EASE }}
    />
  );
}
