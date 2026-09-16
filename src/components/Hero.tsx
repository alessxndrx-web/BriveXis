import { motion, useReducedMotion } from 'motion/react';
import { Container } from './ui/Container';
import { Button } from './ui/Button';
import { SystemPanel } from './visuals/SystemPanel';
import { EASE } from '../lib/motion';
import { CONTACT_ANCHOR } from '../config/site';
import { track } from '../lib/analytics';

const capabilities = [
  'CRM',
  'Operations',
  'Inventory',
  'Sales',
  'Reporting',
  'Automation',
];

export function Hero() {
  const reduceMotion = useReducedMotion();

  const rise = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: EASE },
        };

  return (
    <section className="relative bg-midnight pt-28 sm:pt-32 lg:pt-40 pb-16 lg:pb-24 overflow-hidden">
      {/* Structural grid rules */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-x-0 bottom-0 h-px bg-dark-border" />
      </div>

      <Container className="relative">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] gap-14 lg:gap-12 xl:gap-16 items-center">
          {/* Left: message */}
          <div className="lg:pr-8 xl:pr-14">
            <motion.div {...rise(0)} className="flex items-center gap-3 mb-7">
              <span className="h-px w-8 bg-copper" />
              <span className="text-eyebrow uppercase text-copper-highlight">
                Custom business software
              </span>
            </motion.div>

            <motion.h1
              {...rise(0.06)}
              className="text-hero font-bold text-white-surface max-w-[15ch]"
            >
              Software built around how your business actually works.
            </motion.h1>

            <motion.p
              {...rise(0.12)}
              className="mt-7 text-lead text-muted-dark max-w-[52ch]"
            >
              We design custom systems that replace spreadsheets, manual processes and
              disconnected tools with software built around the way your company operates.
            </motion.p>

            <motion.div
              {...rise(0.18)}
              className="mt-9 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <Button
                href={CONTACT_ANCHOR}
                variant="solid-invert"
                className="w-full sm:w-auto"
                onClick={() => track('cta_hero_click')}
              >
                Discuss Your Project
              </Button>
              <Button href="/#solutions" variant="outline-invert" className="w-full sm:w-auto">
                Explore Solutions
              </Button>
            </motion.div>

            <motion.div {...rise(0.26)} className="mt-10 pt-6 border-t border-dark-border">
              <ul className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {capabilities.map((capability, i) => (
                  <li key={capability} className="flex items-center gap-3">
                    <span className="text-ui font-medium tracking-wide text-muted-dark">
                      {capability}
                    </span>
                    {i < capabilities.length - 1 && (
                      <span aria-hidden="true" className="w-1 h-1 rounded-full bg-copper/70" />
                    )}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          {/* Right: product visual */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, x: 26 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.22, ease: EASE }}
          >
            <SystemPanel />
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
