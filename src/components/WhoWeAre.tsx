import { Container } from './ui/Container';
import { SectionHeader } from './ui/SectionHeader';
import { Reveal, Stagger, StaggerItem } from './ui/Reveal';

const principles = [
  {
    title: 'The operation comes first',
    desc: 'We study how the business runs today before deciding what to build.',
  },
  {
    title: 'Designed around real workflows',
    desc: 'Systems follow the steps your team already takes, not a generic template.',
  },
  {
    title: 'Direct collaboration',
    desc: 'You work with the people designing and developing your system.',
  },
  {
    title: 'Practical software',
    desc: 'Built to be used every day by the people who run the operation.',
  },
];

export function WhoWeAre() {
  return (
    <section
      id="who-we-are"
      aria-labelledby="who-we-are-title"
      className="bg-ivory py-20 sm:py-24 lg:py-32"
    >
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-10 xl:gap-16">
          <div className="lg:col-span-7">
            <SectionHeader
              index="02"
              eyebrow="Who we are"
              titleId="who-we-are-title"
              title={
                <>
                  Technology should adapt to the business.{' '}
                  <span className="text-muted">Not the other way around.</span>
                </>
              }
              titleClassName="max-w-[16ch]"
            />
          </div>

          <div className="lg:col-span-4 lg:col-start-9 lg:self-end">
            <Reveal delay={0.08}>
              <p className="border-t border-light-border pt-6 text-lead text-muted">
                BriveXis is a software studio for companies whose operation has outgrown the
                tools running it. We build the system the business actually needs, not the
                closest subscription we can configure.
              </p>
            </Reveal>
          </div>
        </div>

        <Stagger className="mt-14 lg:mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t border-light-border">
          {principles.map((principle, i) => (
            <StaggerItem
              key={principle.title}
              className={`border-b border-light-border ${i > 0 ? 'lg:border-l' : ''}`}
            >
              <div className={`h-full py-8 pr-6 ${i > 0 ? 'lg:px-7' : 'lg:pr-7'}`}>
                <span className="block text-ui font-semibold tabular-nums text-copper mb-4">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="font-heading font-semibold text-charcoal text-[1.125rem] mb-3 max-w-[18ch]">
                  {principle.title}
                </h3>
                <p className="text-[0.9375rem] leading-relaxed text-muted max-w-[34ch]">
                  {principle.desc}
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </section>
  );
}
