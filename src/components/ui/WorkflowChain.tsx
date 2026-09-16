import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion, Variants } from 'motion/react';
import { EASE, VIEWPORT } from '../../lib/motion';

interface WorkflowChainProps {
  steps: string[];
  tone?: 'light' | 'dark';
  /** Reveal the nodes left to right when the chain enters the viewport. Runs once. */
  animate?: boolean;
  /** After the reveal, walk a single copper highlight through the nodes. Runs once. */
  sequence?: boolean;
  /** React to hover on an ancestor carrying the `group` class. */
  interactive?: boolean;
  className?: string;
}

const nodeVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
};

const arrowVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25, delay: 0.12 } },
};

/** Milliseconds each node holds the copper state during the one-time sequence. */
const STEP_MS = 320;

/**
 * Workflow notation used across solutions, industries and demos:
 * intake -> qualification -> follow-up. Structural, not decorative.
 */
export function WorkflowChain({
  steps,
  tone = 'light',
  animate = false,
  sequence = false,
  interactive = false,
  className = '',
}: WorkflowChainProps) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLOListElement>(null);
  const inView = useInView(ref, { once: true, margin: VIEWPORT.margin });
  const [activeStep, setActiveStep] = useState(-1);

  const shouldAnimate = animate && !reduceMotion;
  const shouldSequence = sequence && !reduceMotion;
  const stepCount = steps.length;

  useEffect(() => {
    if (!shouldSequence || !inView) return;

    // Let the reveal finish before the highlight starts walking the chain.
    const start = shouldAnimate ? stepCount * 70 + 260 : 200;
    const timers = steps.map((_, i) =>
      window.setTimeout(() => setActiveStep(i), start + i * STEP_MS),
    );
    // Settle back into the static chain. The sequence never repeats.
    timers.push(window.setTimeout(() => setActiveStep(-1), start + stepCount * STEP_MS));

    return () => timers.forEach(window.clearTimeout);
  }, [shouldSequence, shouldAnimate, inView, stepCount, steps]);

  const restingStyles =
    tone === 'dark'
      ? 'border-dark-border text-muted-dark'
      : 'border-light-border text-muted bg-white-surface';

  const hoverStyles = interactive
    ? tone === 'dark'
      ? 'group-hover:border-muted-dark/45 group-hover:text-white-surface/90'
      : 'group-hover:border-muted/40 group-hover:text-charcoal'
    : '';

  const activeStyles =
    tone === 'dark'
      ? 'border-copper/70 text-copper-highlight'
      : 'border-copper/70 text-copper bg-white-surface';

  return (
    <motion.ol
      ref={ref}
      className={`flex flex-wrap items-center gap-x-2 gap-y-2 ${className}`}
      initial={shouldAnimate ? 'hidden' : false}
      whileInView={shouldAnimate ? 'visible' : undefined}
      viewport={VIEWPORT}
      variants={
        shouldAnimate
          ? { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }
          : undefined
      }
    >
      {steps.map((step, i) => {
        const isActive = i === activeStep;
        return (
          <motion.li
            key={step}
            className="flex items-center gap-2"
            variants={shouldAnimate ? nodeVariants : undefined}
          >
            <span
              className={`border rounded-[2px] px-2.5 py-1 text-ui font-medium transition-colors duration-200 ${
                isActive ? activeStyles : `${restingStyles} ${hoverStyles}`
              }`}
            >
              {step}
            </span>
            {i < steps.length - 1 && (
              <motion.span
                aria-hidden="true"
                className="text-copper text-ui leading-none"
                variants={shouldAnimate ? arrowVariants : undefined}
              >
                &rarr;
              </motion.span>
            )}
          </motion.li>
        );
      })}
    </motion.ol>
  );
}
