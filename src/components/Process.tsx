import { Container } from './ui/Container';
import { SectionHeader } from './ui/SectionHeader';
import { motion, useReducedMotion } from 'motion/react';
import { Reveal } from './ui/Reveal';
import { EASE, VIEWPORT } from '../lib/motion';

const stages = [
  {
    title: 'Understand',
    desc: 'We study how the business operates today and identify the actual bottleneck — not the one that is easiest to build around.',
    outputs: ['Operational review', 'Bottleneck analysis', 'Scope definition'],
  },
  {
    title: 'Design',
    desc: 'We map workflows, system behavior, information structure and the experience the team will work inside every day.',
    outputs: ['Workflow map', 'System structure', 'Interface design'],
  },
  {
    title: 'Build',
    desc: 'We develop in structured iterations with regular feedback, so the system is validated against the operation while it is being built.',
    outputs: ['Structured iterations', 'Review cycles', 'Technical documentation'],
  },
  {
    title: 'Launch & Improve',
    desc: 'We deploy, support adoption inside the team and keep improving the system as the operation evolves.',
    outputs: ['Deployment', 'Adoption support', 'Ongoing improvement'],
  },
];

export function Process() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="process"
      aria-labelledby="process-title"
      className="bg-white-surface border-y border-light-border py-20 sm:py-24 lg:py-32"
    >
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 mb-14 lg:mb-20">
          <div className="lg:col-span-6">
            <SectionHeader
              index="07"
              eyebrow="Process"
              titleId="process-title"
              title="How a system gets built."
              titleClassName="max-w-[12ch]"
            />
          </div>
          <div className="lg:col-span-5 lg:col-start-8 lg:self-end">
            <Reveal delay={0.08}>
              <p className="border-t border-light-border pt-6 text-lead text-muted">
                Four stages, each with a clear output. You always know what is being
                decided, what is being built and what comes next.
              </p>
            </Reveal>
          </div>
        </div>

        <div>
          {stages.map((stage, i) => (
            <Reveal key={stage.title} y={10}>
              <article className="relative grid grid-cols-1 lg:grid-cols-12 gap-y-6 gap-x-10 border-t border-light-border py-10 lg:py-14 last:border-b last:border-light-border">
                <span
                  aria-hidden="true"
                  className="absolute -top-[3px] left-0 w-1.5 h-1.5 bg-copper"
                />
                {/* Progress: each stage draws its own copper rule as it is reached. */}
                <motion.span
                  aria-hidden="true"
                  className="absolute -top-px inset-x-0 h-px origin-left bg-gradient-to-r from-copper to-transparent"
                  initial={reduceMotion ? false : { scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.6, ease: EASE }}
                />

                <div className="lg:col-span-5 flex items-baseline gap-5">
                  <motion.span
                    className="font-heading font-bold tabular-nums leading-none text-copper text-[clamp(2.75rem,5vw,4.25rem)]"
                    initial={reduceMotion ? false : { opacity: 0.22 }}
                    whileInView={{ opacity: 0.5 }}
                    viewport={VIEWPORT}
                    transition={{ duration: 0.5, delay: 0.12, ease: EASE }}
                    style={reduceMotion ? { opacity: 0.5 } : undefined}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </motion.span>
                  <h3 className="text-stage font-semibold text-charcoal">{stage.title}</h3>
                </div>

                <div className="lg:col-span-7">
                  <p className="text-lead text-muted max-w-[56ch]">{stage.desc}</p>
                  <ul className="mt-6 flex flex-wrap gap-2">
                    {stage.outputs.map((output) => (
                      <li
                        key={output}
                        className="border border-light-border bg-ivory rounded-[2px] px-2.5 py-1 text-ui text-muted"
                      >
                        {output}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
