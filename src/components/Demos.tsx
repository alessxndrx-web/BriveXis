import { ArrowRight } from 'lucide-react';
import { Container } from './ui/Container';
import { SectionHeader } from './ui/SectionHeader';
import { Reveal } from './ui/Reveal';
import { Button } from './ui/Button';
import { WorkflowChain } from './ui/WorkflowChain';
import { DemoPreviewFrame } from './visuals/DemoPreviewFrame';
import { demos } from '../data/demos';
import { track } from '../lib/analytics';

/**
 * Gateway to the three product demos.
 *
 * Each card reads its state from the catalogue in `src/data/demos.ts`. A demo
 * with `status: 'live'` renders a Launch Demo action pointing at its reserved
 * route; everything else stays an honest "Preview coming soon". No dead button
 * is ever shown.
 */
export function Demos() {
  // The lead-in describes what is actually available, so it stays true as
  // each demo ships rather than needing to be remembered and edited.
  const live = demos.filter((demo) => demo.status === 'live');
  const upcoming = demos.length - live.length;

  return (
    <section
      id="demos"
      aria-labelledby="demos-title"
      className="bg-ivory border-b border-light-border py-20 sm:py-24 lg:py-32"
    >
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 mb-14 lg:mb-20">
          <div className="lg:col-span-6">
            <SectionHeader
              index="05"
              eyebrow="Demos"
              titleId="demos-title"
              title="See the systems we're building."
              titleClassName="max-w-[14ch]"
            />
          </div>
          <div className="lg:col-span-5 lg:col-start-8 lg:self-end">
            <Reveal delay={0.08}>
              <p className="border-t border-light-border pt-6 text-lead text-muted">
                {live.length > 0 ? (
                  <>
                    {live.length === 1 ? `${live[0].title} is` : `${live.length} demos are`} live
                    and open to explore &mdash; work a lead through to a paid invoice.{' '}
                    {upcoming > 0 && (
                      <>The remaining {upcoming} previews show how those systems are structured.</>
                    )}
                  </>
                ) : (
                  <>
                    Interactive operational demos are being prepared for our first three
                    industry workflows. The previews below show how each system is structured.
                  </>
                )}
              </p>
            </Reveal>
          </div>
        </div>

        <div className="space-y-14 lg:space-y-20">
          {demos.map((demo, i) => {
            const isLive = demo.status === 'live';

            return (
              <Reveal key={demo.id} y={12}>
                <article
                  aria-labelledby={`demo-${demo.slug}-title`}
                  onMouseEnter={() => track('demo_preview_interact', { demo: demo.slug })}
                  className="group grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-14 items-center border-t border-light-border pt-10 lg:pt-12"
                >
                  <div className="lg:col-span-5">
                    <div className="flex items-center gap-3 mb-5">
                      <span className="text-ui font-semibold tabular-nums text-copper">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-eyebrow uppercase text-muted">{demo.industry}</span>
                    </div>

                    <h3
                      id={`demo-${demo.slug}-title`}
                      className="text-section-sm font-semibold text-charcoal"
                    >
                      {demo.title}
                    </h3>

                    <p className="mt-5 text-muted max-w-[52ch]">{demo.shortDescription}</p>

                    <WorkflowChain
                      steps={demo.workflow}
                      animate
                      interactive
                      sequence={i === 0}
                      className="mt-7"
                    />

                    {demo.features && demo.features.length > 0 && (
                      <ul className="mt-6 space-y-2">
                        {demo.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-3 text-ui text-muted">
                            <span
                              aria-hidden="true"
                              className="mt-2 w-1.5 h-1.5 bg-copper shrink-0"
                            />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-8">
                      {isLive ? (
                        <Button
                          href={demo.route}
                          variant="solid"
                          aria-label={`Launch the ${demo.title} demo`}
                        >
                          Launch Demo
                          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
                        </Button>
                      ) : (
                        <span className="inline-flex items-center gap-2.5 border border-light-border bg-white-surface rounded-[2px] px-4 py-2.5 text-ui font-medium text-muted">
                          <span
                            aria-hidden="true"
                            className="w-1.5 h-1.5 rounded-full bg-copper"
                          />
                          Preview coming soon
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-7">
                    {demo.thumbnail ? (
                      <img
                        src={demo.thumbnail}
                        alt={`${demo.title} interface preview`}
                        loading="lazy"
                        decoding="async"
                        className="w-full rounded-[10px] border border-light-border"
                      />
                    ) : (
                      <DemoPreviewFrame demo={demo} className="group-hover:border-muted/35" />
                    )}
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
