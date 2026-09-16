import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Plus } from 'lucide-react';
import { Container } from './ui/Container';
import { SectionHeader } from './ui/SectionHeader';
import { Reveal } from './ui/Reveal';
import { DURATION, EASE } from '../lib/motion';
import { faqs } from '../data/faq';
import { track } from '../lib/analytics';

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const reduceMotion = useReducedMotion();
  const baseId = useId();

  const toggle = (index: number, question: string) => {
    const opening = openIndex !== index;
    setOpenIndex(opening ? index : null);
    if (opening) track('faq_open', { question });
  };

  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="bg-white-surface border-t border-light-border py-20 sm:py-24 lg:py-32"
    >
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-10 xl:gap-16">
          <div className="lg:col-span-4">
            <SectionHeader
              index="09"
              eyebrow="FAQ"
              titleId="faq-title"
              title="Questions we are asked first."
              titleClassName="max-w-[12ch]"
              size="md"
            />
            <Reveal delay={0.12}>
              <p className="mt-7 text-muted max-w-[38ch]">
                If something here is not covered, describe your operation in the inquiry
                form and we will answer it directly.
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-7 lg:col-start-6">
            <Reveal delay={0.06}>
              <dl className="border-t border-light-border">
                {faqs.map((item, i) => {
                  const isOpen = openIndex === i;
                  const panelId = `${baseId}-panel-${i}`;
                  const buttonId = `${baseId}-question-${i}`;

                  return (
                    <div key={item.question} className="border-b border-light-border">
                      <dt>
                        <button
                          type="button"
                          id={buttonId}
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                          onClick={() => toggle(i, item.question)}
                          className="group flex w-full items-start justify-between gap-6 py-5 text-left"
                        >
                          <span
                            className={`font-heading font-semibold text-[1.0625rem] sm:text-[1.125rem] transition-colors duration-200 ${
                              isOpen ? 'text-charcoal' : 'text-charcoal/80 group-hover:text-charcoal'
                            }`}
                          >
                            {item.question}
                          </span>
                          <Plus
                            aria-hidden="true"
                            size={18}
                            strokeWidth={1.75}
                            className={`mt-1 shrink-0 text-copper transition-transform duration-300 ${
                              isOpen ? 'rotate-45' : 'rotate-0'
                            }`}
                          />
                        </button>
                      </dt>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.dd
                            id={panelId}
                            aria-labelledby={buttonId}
                            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
                            transition={{ duration: DURATION.medium, ease: EASE }}
                            className="overflow-hidden"
                          >
                            <p className="pb-6 pr-10 text-muted max-w-[62ch]">{item.answer}</p>
                          </motion.dd>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </dl>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
