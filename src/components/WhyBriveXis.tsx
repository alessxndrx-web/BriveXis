import { Container } from './ui/Container';
import { SectionHeader } from './ui/SectionHeader';
import { motion, Variants } from 'motion/react';
import { Reveal, Stagger, StaggerItem } from './ui/Reveal';
import { EASE } from '../lib/motion';

const priorities = [
  {
    title: 'Built around your workflow',
    desc: 'We study how the operation runs before deciding what the system should do. The software follows your process instead of replacing it with a generic one.',
  },
  {
    title: 'Direct collaboration',
    desc: 'You work with the people designing and developing the system. No account layer between your operation and the engineers building it.',
  },
  {
    title: 'Nearshore time-zone compatibility',
    desc: 'We operate on UTC-6, which overlaps with U.S. working hours. Decisions happen the same day instead of the next one.',
  },
  {
    title: 'English and Spanish communication',
    desc: 'Teams across the U.S. and Latin America work with us in the language their operation actually runs in.',
  },
];

const secondary = [
  {
    title: 'Scalable architecture',
    desc: 'Built to extend as the operation grows, not to become the next workaround.',
  },
  {
    title: 'Software people actually use',
    desc: 'Interfaces designed for the employees who work inside the system every day.',
  },
];

/** Separator that draws in with its own card, inheriting the stagger timing. */
const lineVariants: Variants = {
  hidden: { scaleX: 0 },
  visible: { scaleX: 1, transition: { duration: 0.5, ease: EASE } },
};

export function WhyBriveXis() {
  return (
    <section
      id="why-us"
      aria-labelledby="why-us-title"
      className="bg-midnight py-20 sm:py-24 lg:py-32"
    >
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-14 lg:mb-20">
          <div className="lg:col-span-8">
            <SectionHeader
              index="06"
              eyebrow="Why BriveXis"
              titleId="why-us-title"
              title={
                <>
                  Software should fit the business.{' '}
                  <span className="text-muted-dark">
                    Not force the business to fit the software.
                  </span>
                </>
              }
              titleClassName="max-w-[18ch]"
              dark
            />
          </div>
        </div>

        <Stagger
          step={0.08}
          className="grid grid-cols-1 md:grid-cols-2 gap-x-10 xl:gap-x-20 gap-y-12 lg:gap-y-16"
        >
          {priorities.map((item) => (
            <StaggerItem key={item.title}>
              <motion.span
                aria-hidden="true"
                variants={lineVariants}
                className="block h-px bg-dark-border origin-left"
              />
              <div className="pt-7">
                <h3 className="text-stage font-semibold text-white-surface max-w-[18ch]">
                  {item.title}
                </h3>
                <p className="mt-4 text-muted-dark max-w-[46ch]">{item.desc}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal className="mt-16 lg:mt-24 pt-10 border-t border-dark-border grid grid-cols-1 sm:grid-cols-2 gap-x-10 xl:gap-x-20 gap-y-8">
          {secondary.map((item) => (
            <div key={item.title} className="flex gap-4">
              <span aria-hidden="true" className="mt-2.5 w-1.5 h-1.5 bg-copper shrink-0" />
              <div>
                <h3 className="font-heading font-semibold text-[1.0625rem] text-white-surface">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-ui leading-relaxed text-muted-dark max-w-[44ch]">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}
